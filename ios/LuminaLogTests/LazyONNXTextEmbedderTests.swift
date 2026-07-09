import XCTest
import CryptoKit
@testable import LuminaLog

/// Unit tests for the runtime bridge that "self-activates" the real on-device
/// embedder: `LazyONNXTextEmbedder` downloads + verifies the model and BOTH tokenizer
/// files via `EmbeddingModelProvider` on first use, then delegates every embed to a
/// concrete embedder built by an injected factory. These tests exercise the
/// resolution/plumbing (fetch all three assets, build the tokenizer directory,
/// single-flight, fail-closed) WITHOUT the real ~200 MB ONNX model — the factory is
/// faked. The real-model behavior is validated separately by the cross-platform
/// parity harness once the artifact is hosted.
final class LazyONNXTextEmbedderTests: XCTestCase {

    /// Fake byte source keyed by URL; records every requested URL so tests can assert
    /// exactly which assets were fetched and how many times.
    private final class FakeDownloader: EmbeddingFileDownloader, @unchecked Sendable {
        var payloads: [URL: Data]
        private(set) var downloadedURLs: [URL] = []
        init(payloads: [URL: Data]) { self.payloads = payloads }
        func download(from url: URL) async throws -> Data {
            downloadedURLs.append(url)
            guard let data = payloads[url] else { throw URLError(.fileDoesNotExist) }
            return data
        }
    }

    /// Fake `TextEmbedder` the factory returns; records the texts it was asked to
    /// embed and returns a fixed vector.
    private final class SpyEmbedder: TextEmbedder, @unchecked Sendable {
        private(set) var embedded: [String] = []
        let vector: EmbeddingVector
        init(vector: EmbeddingVector) { self.vector = vector }
        func embed(_ text: String) async throws -> EmbeddingVector {
            embedded.append(text)
            return vector
        }
    }

    /// Reference box so an `@escaping` factory can record its calls without capturing
    /// a mutable local (Swift-5 data-race friendly).
    private final class FactoryLog: @unchecked Sendable {
        private(set) var calls: [(model: URL, tokenizerDir: URL)] = []
        func record(_ model: URL, _ dir: URL) { calls.append((model, dir)) }
        var count: Int { calls.count }
    }

    private var cacheDir: URL!

    override func setUpWithError() throws {
        cacheDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("LazyONNXTests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: cacheDir)
    }

    private func asset(_ filename: String, _ data: Data) -> EmbeddingModelAsset {
        EmbeddingModelAsset(
            url: URL(string: "https://cdn.example.com/\(filename)")!,
            sha256Hex: EmbeddingModelProvider.sha256Hex(of: data),
            filename: filename
        )
    }

    private func fixedVector() -> EmbeddingVector {
        var components = [Float](repeating: 0, count: EmbeddingVector.dimension)
        components[0] = 1
        return EmbeddingVector(components)
    }

    // MARK: - Happy path

    func testResolvesAllThreeAssetsThenDelegates() async throws {
        let modelData = Data("onnx-model-bytes".utf8)
        let tokData = Data("tokenizer.json".utf8)
        let cfgData = Data("tokenizer_config.json".utf8)
        let model = asset("embeddinggemma-300m.onnx", modelData)
        let tok = asset("tokenizer.json", tokData)
        let cfg = asset("tokenizer_config.json", cfgData)

        let downloader = FakeDownloader(payloads: [
            model.url: modelData, tok.url: tokData, cfg.url: cfgData,
        ])
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)
        let spy = SpyEmbedder(vector: fixedVector())
        let log = FactoryLog()

        let sut = LazyONNXTextEmbedder(
            modelAsset: model, tokenizerAsset: tok, tokenizerConfigAsset: cfg,
            provider: provider,
            makeEmbedder: { modelURL, dir in log.record(modelURL, dir); return spy }
        )

        let out = try await sut.embed("hello world")

        XCTAssertEqual(out, spy.vector)
        XCTAssertEqual(spy.embedded, ["hello world"])
        // All three assets fetched exactly once.
        XCTAssertEqual(Set(downloader.downloadedURLs), Set([model.url, tok.url, cfg.url]))
        XCTAssertEqual(downloader.downloadedURLs.count, 3)
        // Factory built the embedder from the cached model path + the shared
        // tokenizer directory (where both JSON files landed).
        XCTAssertEqual(log.count, 1)
        XCTAssertEqual(log.calls.first?.model, provider.localURL(for: model))
        XCTAssertEqual(log.calls.first?.tokenizerDir, provider.localURL(for: tok).deletingLastPathComponent())
        // Both tokenizer files really coexist in that directory.
        XCTAssertTrue(FileManager.default.fileExists(atPath: provider.localURL(for: tok).path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: provider.localURL(for: cfg).path))
    }

    // MARK: - Single-flight

    func testConcurrentFirstCallsResolveOnce() async throws {
        let modelData = Data("m".utf8), tokData = Data("t".utf8), cfgData = Data("c".utf8)
        let model = asset("embeddinggemma-300m.onnx", modelData)
        let tok = asset("tokenizer.json", tokData)
        let cfg = asset("tokenizer_config.json", cfgData)
        let downloader = FakeDownloader(payloads: [model.url: modelData, tok.url: tokData, cfg.url: cfgData])
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)
        let spy = SpyEmbedder(vector: fixedVector())
        let log = FactoryLog()
        let sut = LazyONNXTextEmbedder(
            modelAsset: model, tokenizerAsset: tok, tokenizerConfigAsset: cfg,
            provider: provider,
            makeEmbedder: { m, d in log.record(m, d); return spy }
        )

        async let a = sut.embed("a")
        async let b = sut.embed("b")
        async let c = sut.embed("c")
        _ = try await [a, b, c]

        // Resolved exactly once despite three concurrent first calls.
        XCTAssertEqual(log.count, 1)
        XCTAssertEqual(downloader.downloadedURLs.count, 3, "single download pass for three concurrent embeds")
    }

    // MARK: - Fail closed + retry

    func testResolutionFailurePropagatesAndIsNotCached() async throws {
        let modelData = Data("real-model".utf8)
        let model = asset("embeddinggemma-300m.onnx", modelData)
        let tok = asset("tokenizer.json", Data("t".utf8))
        let cfg = asset("tokenizer_config.json", Data("c".utf8))
        // Downloader hands back tampered model bytes → integrity check fails.
        let downloader = FakeDownloader(payloads: [
            model.url: Data("tampered".utf8),
            tok.url: Data("t".utf8),
            cfg.url: Data("c".utf8),
        ])
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)
        let log = FactoryLog()
        let sut = LazyONNXTextEmbedder(
            modelAsset: model, tokenizerAsset: tok, tokenizerConfigAsset: cfg,
            provider: provider,
            makeEmbedder: { m, d in log.record(m, d); return SpyEmbedder(vector: self.fixedVector()) }
        )

        do {
            _ = try await sut.embed("x")
            XCTFail("expected resolution to fail closed on integrity mismatch")
        } catch {
            // expected
        }
        XCTAssertEqual(log.count, 0, "never build an embedder from unverified bytes")

        // Repair the source and retry — a failed resolution must NOT be cached.
        downloader.payloads[model.url] = modelData
        let out = try await sut.embed("x")
        XCTAssertEqual(out, fixedVector())
        XCTAssertEqual(log.count, 1, "retry after a fixed source resolves successfully")
    }
}
