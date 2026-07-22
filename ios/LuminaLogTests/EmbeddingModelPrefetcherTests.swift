import XCTest
import CryptoKit
@testable import LuminaLog

/// Unit tests for the proactive model prefetch: it must warm the shared cache so a
/// later lazy fetch is a hit (no re-download), and it must be best-effort (a single
/// asset failing never throws or blocks the others).
final class EmbeddingModelPrefetcherTests: XCTestCase {

    /// URL-keyed fake byte source. A `nil` payload for a URL simulates a download
    /// failure (throws) so we can assert best-effort behavior. Streams to a temp file
    /// per the `download(from:) -> URL` contract.
    private final class FakeDownloader: EmbeddingFileDownloader, @unchecked Sendable {
        var payloads: [URL: Data]
        private(set) var downloadedURLs: [URL] = []
        init(payloads: [URL: Data]) { self.payloads = payloads }
        func download(from url: URL) async throws -> URL {
            downloadedURLs.append(url)
            guard let data = payloads[url] else { throw URLError(.timedOut) }
            let temp = FileManager.default.temporaryDirectory
                .appendingPathComponent("prefetch-dl-\(UUID().uuidString).tmp")
            try data.write(to: temp)
            return temp
        }
    }

    private var cacheDir: URL!

    override func setUpWithError() throws {
        cacheDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("PrefetcherTests-\(UUID().uuidString)", isDirectory: true)
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

    func testPrefetchWarmsCacheSoLazyFetchIsAHit() async throws {
        let modelData = Data("model".utf8), tokData = Data("tok".utf8), cfgData = Data("cfg".utf8)
        let model = asset("model.onnx", modelData)
        let tok = asset("tokenizer.json", tokData)
        let cfg = asset("tokenizer_config.json", cfgData)
        let downloader = FakeDownloader(payloads: [
            model.url: modelData, tok.url: tokData, cfg.url: cfgData,
        ])
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)

        let ready = await EmbeddingModelPrefetcher(
            assets: [model, tok, cfg], provider: provider
        ).prefetch()

        XCTAssertTrue(ready, "all assets cached → model is ready")
        XCTAssertEqual(Set(downloader.downloadedURLs), Set([model.url, tok.url, cfg.url]))
        XCTAssertEqual(downloader.downloadedURLs.count, 3, "each asset fetched once")

        // A later lazy fetch (the on-demand path shares the same cache dir) is a hit.
        _ = try await provider.fetch(model)
        XCTAssertEqual(downloader.downloadedURLs.count, 3, "prefetched asset must not re-download")
    }

    func testPrefetchIsBestEffortWhenOneAssetFails() async throws {
        let modelData = Data("model".utf8), cfgData = Data("cfg".utf8)
        let model = asset("model.onnx", modelData)
        let tok = asset("tokenizer.json", Data("tok".utf8))   // payload omitted → fails
        let cfg = asset("tokenizer_config.json", cfgData)
        let downloader = FakeDownloader(payloads: [model.url: modelData, cfg.url: cfgData])
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)

        // Must not throw despite the tokenizer download failing, and must report
        // not-ready so the caller skips background backfill.
        let ready = await EmbeddingModelPrefetcher(
            assets: [model, tok, cfg], provider: provider
        ).prefetch()
        XCTAssertFalse(ready, "a failed asset means the model is not ready")

        // The two good assets still landed in the cache.
        XCTAssertTrue(FileManager.default.fileExists(atPath: provider.localURL(for: model).path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: provider.localURL(for: cfg).path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: provider.localURL(for: tok).path),
                       "the failed asset is simply absent — retried later")
    }
}
