import XCTest
import CryptoKit
@testable import LuminaLog

final class EmbeddingModelProviderTests: XCTestCase {

    /// Counting fake downloader — returns preset bytes and records how many times it
    /// was hit, so tests can assert the cache path avoids the network.
    private final class FakeDownloader: EmbeddingFileDownloader {
        var payload: Data
        private(set) var callCount = 0
        init(payload: Data) { self.payload = payload }
        func download(from url: URL) async throws -> Data {
            callCount += 1
            return payload
        }
    }

    private var cacheDir: URL!

    override func setUpWithError() throws {
        cacheDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("EmbeddingModelProviderTests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: cacheDir)
    }

    private func asset(for data: Data, filename: String = "model.onnx") -> EmbeddingModelAsset {
        EmbeddingModelAsset(
            url: URL(string: "https://cdn.example.com/\(filename)")!,
            sha256Hex: EmbeddingModelProvider.sha256Hex(of: data),
            filename: filename
        )
    }

    func testDownloadsAndCachesWhenHashMatches() async throws {
        let payload = Data("the-real-model-bytes".utf8)
        let downloader = FakeDownloader(payload: payload)
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)
        let asset = asset(for: payload)

        let local = try await provider.fetch(asset)

        XCTAssertEqual(downloader.callCount, 1)
        XCTAssertEqual(try Data(contentsOf: local), payload)
        XCTAssertEqual(local, provider.localURL(for: asset))
    }

    func testCachedFileReusedWithoutRedownload() async throws {
        let payload = Data("cache-me".utf8)
        let downloader = FakeDownloader(payload: payload)
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)
        let asset = asset(for: payload)

        _ = try await provider.fetch(asset)   // primes cache (1 download)
        _ = try await provider.fetch(asset)   // served from disk
        _ = try await provider.fetch(asset)

        XCTAssertEqual(downloader.callCount, 1, "cached bytes must not re-download")
    }

    func testHashMismatchRejectedAndCacheNotPoisoned() async throws {
        let realPayload = Data("expected-bytes".utf8)
        // Downloader hands back DIFFERENT bytes than the asset's expected hash.
        let downloader = FakeDownloader(payload: Data("tampered-bytes".utf8))
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)
        let asset = asset(for: realPayload)   // hash of the *real* payload

        do {
            _ = try await provider.fetch(asset)
            XCTFail("expected integrity failure")
        } catch let error as EmbeddingModelProviderError {
            guard case .integrityCheckFailed = error else {
                return XCTFail("wrong error: \(error)")
            }
        }

        // The bad bytes must NOT have been written to the cache path.
        XCTAssertFalse(FileManager.default.fileExists(atPath: provider.localURL(for: asset).path),
                       "a failed download must not poison the cache")
    }

    func testCorruptCachedFileTriggersRedownload() async throws {
        let payload = Data("good-model".utf8)
        let downloader = FakeDownloader(payload: payload)
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)
        let asset = asset(for: payload)

        // Plant a corrupt file at the cache path (wrong hash).
        try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        try Data("corrupt".utf8).write(to: provider.localURL(for: asset))

        let local = try await provider.fetch(asset)

        XCTAssertEqual(downloader.callCount, 1, "corrupt cache must be re-fetched")
        XCTAssertEqual(try Data(contentsOf: local), payload)
    }

    func testAssetLowercasesHash() {
        let a = EmbeddingModelAsset(url: URL(string: "https://x/y")!, sha256Hex: "ABCDEF", filename: "f")
        XCTAssertEqual(a.sha256Hex, "abcdef")
    }
}
