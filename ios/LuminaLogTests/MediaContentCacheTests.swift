import XCTest
import CryptoKit
@testable import LuminaLog

final class MediaContentCacheTests: XCTestCase {

    private var tmpDir: URL!

    override func setUpWithError() throws {
        tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("mcc-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tmpDir)
    }

    /// Writes `plaintext`, encrypts it with `key`, returns the ciphertext file URL.
    private func makeCiphertextFile(_ plaintext: Data, key: SymmetricKey) throws -> URL {
        let plain = tmpDir.appendingPathComponent("plain-\(UUID().uuidString).bin")
        try plaintext.write(to: plain)
        let cipher = tmpDir.appendingPathComponent("cipher-\(UUID().uuidString).bin")
        try MediaCipher(key: key).encryptFile(at: plain, to: cipher)
        return cipher
    }

    private func makeCache(serving source: URL) -> MediaContentCache {
        let cacheDir = tmpDir.appendingPathComponent("cache", isDirectory: true)
        let dir = tmpDir!
        return MediaContentCache(directory: cacheDir) { _ in
            // Simulate a download by copying the served file to a fresh temp file.
            let dest = dir.appendingPathComponent("dl-\(UUID().uuidString)")
            try FileManager.default.copyItem(at: source, to: dest)
            return dest
        }
    }

    func testDecryptsCiphertextToPlaintextFile() async throws {
        let key = SymmetricKey(size: .bits256)
        let plaintext = Data("hello journal photo bytes".utf8)
        let cipher = try makeCiphertextFile(plaintext, key: key)
        let cache = makeCache(serving: cipher)

        let url = try await cache.fileURL(
            for: "users/u1/journals/j1/image-abc.jpg",
            from: URL(string: "https://example.com/x")!,
            key: key
        )

        XCTAssertEqual(try Data(contentsOf: url), plaintext)
        XCTAssertEqual(url.pathExtension, "jpg")
    }

    func testPassesPlaintextThroughWhenNoMagic() async throws {
        // Demo/legacy files are not "LLM1" — return them as-is even with a key.
        let key = SymmetricKey(size: .bits256)
        let plaintext = Data("raw plaintext, no magic".utf8)
        let plain = tmpDir.appendingPathComponent("raw.jpg")
        try plaintext.write(to: plain)
        let cache = makeCache(serving: plain)

        let url = try await cache.fileURL(
            for: "users/u1/journals/j1/image-def.jpg",
            from: URL(string: "https://example.com/x")!,
            key: key
        )

        XCTAssertEqual(try Data(contentsOf: url), plaintext)
    }

    func testReturnsCachedFileOnSecondCall() async throws {
        let key = SymmetricKey(size: .bits256)
        let cipher = try makeCiphertextFile(Data("cached".utf8), key: key)
        let cache = makeCache(serving: cipher)
        let s3Key = "users/u1/journals/j1/image-ghi.jpg"

        let first = try await cache.fileURL(for: s3Key, from: URL(string: "https://x")!, key: key)
        let second = try await cache.fileURL(for: s3Key, from: URL(string: "https://x")!, key: key)

        XCTAssertEqual(first, second)
    }

    func testPurgeRemovesCachedFiles() async throws {
        let key = SymmetricKey(size: .bits256)
        let cipher = try makeCiphertextFile(Data("purge me".utf8), key: key)
        let cache = makeCache(serving: cipher)
        let url = try await cache.fileURL(for: "users/u1/journals/j1/image-x.jpg",
                                          from: URL(string: "https://x")!, key: key)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))

        await cache.purge()
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
    }

    func testSeedMakesFileURLResolveLocallyWithoutFetch() async throws {
        // A cache whose fetch would FAIL — proving seed() means no network is used.
        let cacheDir = tmpDir.appendingPathComponent("cache", isDirectory: true)
        let cache = MediaContentCache(directory: cacheDir) { _ in
            struct FetchCalled: Error {}
            throw FetchCalled()
        }
        let s3Key = "users/u1/journals/j1/audio-seed.m4a"
        let plaintext = Data("recorded audio bytes".utf8)
        let plain = tmpDir.appendingPathComponent("original.m4a")
        try plaintext.write(to: plain)

        try await cache.seed(plaintext: plain, for: s3Key)
        let url = try await cache.fileURL(for: s3Key,
                                          from: URL(string: "https://example.com/never")!,
                                          key: SymmetricKey(size: .bits256))

        XCTAssertEqual(try Data(contentsOf: url), plaintext)
        XCTAssertEqual(url.pathExtension, "m4a")
    }

    func testSeedIsIdempotentAndKeepsFirstBytes() async throws {
        let cacheDir = tmpDir.appendingPathComponent("cache2", isDirectory: true)
        let cache = MediaContentCache(directory: cacheDir) { _ in
            struct FetchCalled: Error {}
            throw FetchCalled()
        }
        let s3Key = "users/u1/journals/j1/audio-idem.m4a"
        let first = tmpDir.appendingPathComponent("first.m4a")
        let second = tmpDir.appendingPathComponent("second.m4a")
        try Data("first".utf8).write(to: first)
        try Data("second-different".utf8).write(to: second)

        try await cache.seed(plaintext: first, for: s3Key)
        try await cache.seed(plaintext: second, for: s3Key)  // must NOT overwrite
        let url = try await cache.fileURL(for: s3Key,
                                          from: URL(string: "https://example.com/never")!,
                                          key: nil)

        XCTAssertEqual(try Data(contentsOf: url), Data("first".utf8))
    }
}
