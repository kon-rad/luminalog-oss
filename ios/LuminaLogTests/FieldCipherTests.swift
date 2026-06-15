import XCTest
import CryptoKit
@testable import LuminaLog

final class FieldCipherTests: XCTestCase {

    private let key = SymmetricKey(size: .bits256)

    func testRoundTrip() throws {
        let cipher = FieldCipher(key: key)
        let envelope = try cipher.encrypt("hello world", context: "journals.content")
        let plaintext = try cipher.decrypt(envelope, context: "journals.content")
        XCTAssertEqual(plaintext, "hello world")
    }

    func testCiphertextIsNotPlaintext() throws {
        let cipher = FieldCipher(key: key)
        let envelope = try cipher.encrypt("secret diary", context: "journals.content")
        XCTAssertNotEqual(String(data: envelope.ciphertext, encoding: .utf8), "secret diary")
    }

    func testWrongContextFailsClosed() throws {
        let cipher = FieldCipher(key: key)
        let envelope = try cipher.encrypt("data", context: "journals.content")
        XCTAssertThrowsError(try cipher.decrypt(envelope, context: "journals.title"))
    }

    func testWrongKeyFailsClosed() throws {
        let envelope = try FieldCipher(key: key).encrypt("data", context: "c")
        let other = FieldCipher(key: SymmetricKey(size: .bits256))
        XCTAssertThrowsError(try other.decrypt(envelope, context: "c"))
    }

    func testTamperedTagFailsClosed() throws {
        let cipher = FieldCipher(key: key)
        let env = try cipher.encrypt("data", context: "c")
        let tampered = EncryptedField(iv: env.iv, ciphertext: env.ciphertext,
                                      tag: Data(repeating: 0, count: env.tag.count))
        XCTAssertThrowsError(try cipher.decrypt(tampered, context: "c"))
    }

    func testNonceIsRandomPerCall() throws {
        let cipher = FieldCipher(key: key)
        let a = try cipher.encrypt("data", context: "c")
        let b = try cipher.encrypt("data", context: "c")
        XCTAssertNotEqual(a.iv, b.iv)
        XCTAssertNotEqual(a.ciphertext, b.ciphertext)
    }
}
