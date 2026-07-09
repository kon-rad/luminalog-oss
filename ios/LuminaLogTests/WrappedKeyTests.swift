import XCTest
import CryptoKit
@testable import LuminaLog

final class WrappedKeyTests: XCTestCase {

    func testFirestoreRoundTrip() throws {
        // Well-formed envelope: 12-byte GCM nonce, 16-byte tag.
        let wrap = WrappedKey(
            iv: Data(repeating: 0x01, count: 12),
            ct: Data([0xAA, 0xBB, 0xCC]),
            tag: Data(repeating: 0xDD, count: 16)
        )
        let dict = wrap.firestoreData
        XCTAssertEqual(dict["v"] as? Int, 1)

        let decoded = try XCTUnwrap(WrappedKey(data: dict))
        XCTAssertEqual(decoded, wrap)
    }

    func testRejectsMalformedEnvelopeSizes() {
        // Wrong nonce length (11 bytes) and wrong tag length (15 bytes) are rejected
        // at parse — early fail-closed on malformed sizes (N4).
        let shortIV: [String: Any] = [
            "v": 1,
            "iv": Data(repeating: 0, count: 11).base64EncodedString(),
            "ct": Data([0xAA]).base64EncodedString(),
            "tag": Data(repeating: 0, count: 16).base64EncodedString(),
        ]
        XCTAssertNil(WrappedKey(data: shortIV))

        let shortTag: [String: Any] = [
            "v": 1,
            "iv": Data(repeating: 0, count: 12).base64EncodedString(),
            "ct": Data([0xAA]).base64EncodedString(),
            "tag": Data(repeating: 0, count: 15).base64EncodedString(),
        ]
        XCTAssertNil(WrappedKey(data: shortTag))

        let emptyCT: [String: Any] = [
            "v": 1,
            "iv": Data(repeating: 0, count: 12).base64EncodedString(),
            "ct": "",
            "tag": Data(repeating: 0, count: 16).base64EncodedString(),
        ]
        XCTAssertNil(WrappedKey(data: emptyCT))
    }

    func testRejectsWrongVersion() {
        let dict: [String: Any] = ["v": 2, "iv": "AA==", "ct": "AA==", "tag": "AA=="]
        XCTAssertNil(WrappedKey(data: dict))
    }

    func testRejectsMissingFields() {
        XCTAssertNil(WrappedKey(data: ["v": 1, "iv": "AA==", "ct": "AA=="]))       // no tag
        XCTAssertNil(WrappedKey(data: ["v": 1, "iv": "!!!", "ct": "AA==", "tag": "AA=="])) // bad b64
    }

    func testRejectsPlainString() {
        XCTAssertNil(WrappedKey(data: "just text"))
        XCTAssertNil(WrappedKey(data: nil))
    }

    func testWrapUnwrapRoundTrip() throws {
        let dek = SymmetricKey(size: .bits256)
        let kek = SymmetricKey(size: .bits256)
        let wrap = WrappedKey.wrapping(dek: dek, under: kek)
        let opened = try wrap.unwrapping(under: kek)
        XCTAssertEqual(opened.rawData, dek.rawData)
    }

    func testUnwrapWithWrongKEKFailsClosed() throws {
        let dek = SymmetricKey(size: .bits256)
        let wrap = WrappedKey.wrapping(dek: dek, under: SymmetricKey(size: .bits256))
        XCTAssertThrowsError(try wrap.unwrapping(under: SymmetricKey(size: .bits256)))
    }

    func testTamperedTagFailsClosed() throws {
        let dek = SymmetricKey(size: .bits256)
        let kek = SymmetricKey(size: .bits256)
        let wrap = WrappedKey.wrapping(dek: dek, under: kek)
        let tampered = WrappedKey(iv: wrap.iv, ct: wrap.ct,
                                  tag: Data(repeating: 0, count: wrap.tag.count))
        XCTAssertThrowsError(try tampered.unwrapping(under: kek))
    }

    func testTamperedCiphertextFailsClosed() throws {
        // GCM authenticates the ciphertext too — flipping a ct byte must fail (N3).
        let dek = SymmetricKey(size: .bits256)
        let kek = SymmetricKey(size: .bits256)
        let wrap = WrappedKey.wrapping(dek: dek, under: kek)
        var ct = wrap.ct
        ct[ct.startIndex] ^= 0xFF
        let tampered = WrappedKey(iv: wrap.iv, ct: ct, tag: wrap.tag)
        XCTAssertThrowsError(try tampered.unwrapping(under: kek))
    }

    func testFreshNoncePerWrap() {
        // Two wraps of the same DEK under the same KEK must use different nonces,
        // so ciphertext differs — locks in the fresh-nonce guarantee (N2).
        let dek = SymmetricKey(size: .bits256)
        let kek = SymmetricKey(size: .bits256)
        let a = WrappedKey.wrapping(dek: dek, under: kek)
        let b = WrappedKey.wrapping(dek: dek, under: kek)
        XCTAssertNotEqual(a.iv, b.iv, "GCM nonce must be fresh per seal")
        XCTAssertNotEqual(a.ct, b.ct, "ciphertext must differ under a fresh nonce")
    }
}
