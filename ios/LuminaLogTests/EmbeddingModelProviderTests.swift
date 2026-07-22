import XCTest
import CryptoKit
@testable import LuminaLog

final class EmbeddingModelProviderTests: XCTestCase {

    /// Counting fake downloader — writes preset bytes to a temp file (matching the
    /// streaming `download(from:) -> URL` contract) and records how many times it was
    /// hit, so tests can assert the cache path avoids the network.
    private final class FakeDownloader: EmbeddingFileDownloader {
        var payload: Data
        private(set) var callCount = 0
        init(payload: Data) { self.payload = payload }
        func download(from url: URL) async throws -> URL {
            callCount += 1
            let temp = FileManager.default.temporaryDirectory
                .appendingPathComponent("fake-dl-\(UUID().uuidString).tmp")
            try payload.write(to: temp)
            return temp
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

    // MARK: - Verified marker (skip cold-start re-hash)

    func testVerifiedMarkerAvoidsRedownloadOnNewProvider() async throws {
        let payload = Data("marker-me".utf8)
        let asset = asset(for: payload)
        let d1 = FakeDownloader(payload: payload)
        _ = try await EmbeddingModelProvider(downloader: d1, cacheDirectory: cacheDir).fetch(asset)
        XCTAssertEqual(d1.callCount, 1)

        // A brand-new provider over the same cache dir serves from the marker fast path
        // — no download and (crucially) no full re-hash of the file.
        let d2 = FakeDownloader(payload: payload)
        let local = try await EmbeddingModelProvider(downloader: d2, cacheDirectory: cacheDir).fetch(asset)
        XCTAssertEqual(d2.callCount, 0, "verified marker must skip re-download")
        XCTAssertEqual(try Data(contentsOf: local), payload)
    }

    func testLegacyCacheWithoutMarkerIsVerifiedNotRedownloaded() async throws {
        let payload = Data("legacy-good".utf8)
        let asset = asset(for: payload)
        // Plant a valid cached file with NO marker (a pre-marker cache).
        try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        let seed = EmbeddingModelProvider(downloader: FakeDownloader(payload: payload), cacheDirectory: cacheDir)
        try payload.write(to: seed.localURL(for: asset))

        let d = FakeDownloader(payload: payload)
        let local = try await EmbeddingModelProvider(downloader: d, cacheDirectory: cacheDir).fetch(asset)
        XCTAssertEqual(d.callCount, 0, "a valid legacy cache is adopted via streamed verify, not re-downloaded")
        XCTAssertEqual(try Data(contentsOf: local), payload)

        // The adopt path also wrote a marker, so the next fetch takes the fast path.
        let d3 = FakeDownloader(payload: payload)
        _ = try await EmbeddingModelProvider(downloader: d3, cacheDirectory: cacheDir).fetch(asset)
        XCTAssertEqual(d3.callCount, 0)
    }

    func testMarkerSizeMismatchForcesRedownload() async throws {
        let payload = Data(repeating: 0xAB, count: 4096)
        let asset = asset(for: payload)
        let good = FakeDownloader(payload: payload)
        let provider = EmbeddingModelProvider(downloader: good, cacheDirectory: cacheDir)
        _ = try await provider.fetch(asset)   // writes file + marker
        XCTAssertEqual(good.callCount, 1)

        // Truncate the cached file: the marker's recorded size no longer matches, so the
        // cheap fast path is rejected and a full verify (which now fails) re-downloads.
        try Data(repeating: 0xAB, count: 10).write(to: provider.localURL(for: asset))

        let re = FakeDownloader(payload: payload)
        let local = try await EmbeddingModelProvider(downloader: re, cacheDirectory: cacheDir).fetch(asset)
        XCTAssertEqual(re.callCount, 1, "a truncated cache must be re-downloaded, not trusted")
        XCTAssertEqual(try Data(contentsOf: local), payload)
    }

    /// The streamed file hash (chunked, constant memory) must equal the whole-buffer
    /// hash — and a multi-MB payload (spanning several 1 MB read chunks) must still
    /// verify + cache correctly.
    func testStreamingVerifyMatchesWholeBufferHashForLargePayload() async throws {
        var payload = Data(count: 5 << 20)   // 5 MB → crosses the 1 MB chunk boundary
        payload.withUnsafeMutableBytes { raw in
            let bytes = raw.bindMemory(to: UInt8.self)
            for i in stride(from: 0, to: bytes.count, by: 7) { bytes[i] = UInt8(i & 0xFF) }
        }
        let downloader = FakeDownloader(payload: payload)
        let provider = EmbeddingModelProvider(downloader: downloader, cacheDirectory: cacheDir)
        let asset = asset(for: payload)

        let local = try await provider.fetch(asset)

        // Streamed file hash equals the in-memory hash of the same bytes.
        XCTAssertEqual(try EmbeddingModelProvider.sha256Hex(ofFileAt: local),
                       EmbeddingModelProvider.sha256Hex(of: payload))
        // Cached copy is byte-identical, and a re-fetch is served from disk.
        XCTAssertEqual(try Data(contentsOf: local), payload)
        _ = try await provider.fetch(asset)
        XCTAssertEqual(downloader.callCount, 1, "large cached file must not re-download")
    }
}
