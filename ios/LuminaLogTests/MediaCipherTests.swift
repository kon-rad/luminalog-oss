import XCTest
import CryptoKit
@testable import LuminaLog

final class MediaCipherTests: XCTestCase {

    private let key = SymmetricKey(size: .bits256)

    private func tempURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
    }

    func testRoundTripSmallFile() throws {
        let cipher = MediaCipher(key: key)
        let plain = tempURL(), enc = tempURL(), dec = tempURL()
        defer { [plain, enc, dec].forEach { try? FileManager.default.removeItem(at: $0) } }

        let payload = Data("hello media".utf8)
        try payload.write(to: plain)

        try cipher.encryptFile(at: plain, to: enc)
        // Ciphertext on disk must not equal the plaintext.
        XCTAssertNotEqual(try Data(contentsOf: enc), payload)

        try cipher.decryptFile(at: enc, to: dec)
        XCTAssertEqual(try Data(contentsOf: dec), payload)
    }

    func testRoundTripMultiChunkFile() throws {
        let cipher = MediaCipher(key: key, chunkSize: 1024)
        let plain = tempURL(), enc = tempURL(), dec = tempURL()
        defer { [plain, enc, dec].forEach { try? FileManager.default.removeItem(at: $0) } }

        // ~10 KB → spans multiple 1 KB chunks.
        let payload = Data((0..<10_000).map { UInt8($0 % 251) })
        try payload.write(to: plain)

        try cipher.encryptFile(at: plain, to: enc)
        try cipher.decryptFile(at: enc, to: dec)
        XCTAssertEqual(try Data(contentsOf: dec), payload)
    }

    func testTamperedCiphertextFailsClosed() throws {
        let cipher = MediaCipher(key: key, chunkSize: 1024)
        let plain = tempURL(), enc = tempURL(), dec = tempURL()
        defer { [plain, enc, dec].forEach { try? FileManager.default.removeItem(at: $0) } }

        try Data((0..<5_000).map { UInt8($0 % 251) }).write(to: plain)
        try cipher.encryptFile(at: plain, to: enc)

        var bytes = try Data(contentsOf: enc)
        bytes[bytes.count - 1] ^= 0xFF          // flip a tag bit
        try bytes.write(to: enc)

        XCTAssertThrowsError(try cipher.decryptFile(at: enc, to: dec))
    }
}
