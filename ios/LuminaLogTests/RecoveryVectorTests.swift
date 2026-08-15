import XCTest
import CryptoKit
@testable import LuminaLog

/// THE DRIFT GUARD, iOS half. Asserts the SAME fixture as the web suite
/// (`web/src/lib/crypto/keys/vectors.test.ts`) so neither platform's recovery
/// crypto can move without turning exactly one of the two suites red.
///
/// A wrong HKDF parameter or a mangled glyph map does not fail loudly: it
/// produces a DEK that decrypts nothing, and the only other detector is a user
/// losing their journal. Hence a shared fixture rather than two suites that
/// agree only by luck.
///
/// Reads the fixture from the web tree by relative path so there is only ever
/// one copy of the vectors in the repo.
final class RecoveryVectorTests: XCTestCase {

    struct Envelope: Decodable {
        let v: Int
        let iv: String
        let ct: String
        let tag: String
    }

    struct Vector: Decodable {
        let code: String
        let normalized: String
        let kekHex: String
        let dekHex: String
        let envelope: Envelope
    }

    struct Fixture: Decodable {
        let cases: [Vector]
    }

    private func loadFixture() throws -> Fixture {
        // .../ios/LuminaLogTests/RecoveryVectorTests.swift up to the repo root,
        // then across into the web tree.
        let here = URL(fileURLWithPath: #filePath)
        let url = here
            .deletingLastPathComponent()   // LuminaLogTests
            .deletingLastPathComponent()   // ios
            .deletingLastPathComponent()   // luminalog-oss
            .appendingPathComponent("web/src/lib/crypto/keys/__fixtures__/recovery-vectors.json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(Fixture.self, from: data)
    }

    private func hex(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }

    func testVectorsMatchCryptoKit() throws {
        let fixture = try loadFixture()
        XCTAssertEqual(fixture.cases.count, 3)

        for (i, v) in fixture.cases.enumerated() {
            XCTAssertEqual(RecoveryCode.normalize(v.code), v.normalized, "case \(i) normalize")

            let kek = RecoveryCode.deriveKEK(from: v.code)
            XCTAssertEqual(hex(kek.rawData), v.kekHex, "case \(i) KEK")

            guard
                let iv = Data(base64Encoded: v.envelope.iv),
                let ct = Data(base64Encoded: v.envelope.ct),
                let tag = Data(base64Encoded: v.envelope.tag)
            else {
                XCTFail("case \(i): malformed base64 in fixture")
                return
            }
            let box = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: iv), ciphertext: ct, tag: tag)
            let dek = try AES.GCM.open(box, using: kek)
            XCTAssertEqual(hex(dek), v.dekHex, "case \(i) DEK")
        }
    }
}
