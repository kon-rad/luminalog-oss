import XCTest
@testable import LuminaLog

final class EncryptedFieldTests: XCTestCase {

    func testFirestoreDictRoundTrip() throws {
        let field = EncryptedField(
            iv: Data([0x01, 0x02, 0x03]),
            ciphertext: Data([0xAA, 0xBB]),
            tag: Data([0xCC, 0xDD])
        )
        let dict = field.firestoreData
        XCTAssertEqual(dict["v"] as? Int, 1)
        XCTAssertEqual(dict["alg"] as? String, "A256GCM")

        let decoded = try XCTUnwrap(EncryptedField(data: dict))
        XCTAssertEqual(decoded, field)
    }

    func testRejectsWrongVersion() {
        let dict: [String: Any] = ["v": 2, "alg": "A256GCM", "iv": "AA==", "ct": "AA==", "tag": "AA=="]
        XCTAssertNil(EncryptedField(data: dict))
    }

    func testRejectsPlainString() {
        // A plaintext string where an envelope is expected must not parse.
        XCTAssertNil(EncryptedField(data: "just text"))
    }
}
