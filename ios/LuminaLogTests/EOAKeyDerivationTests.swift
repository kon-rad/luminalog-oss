import XCTest
import CryptoKit
@testable import LuminaLog

final class EOAKeyDerivationTests: XCTestCase {
    func testFixedMessageIsExactlyTheSpecdString() {
        XCTAssertEqual(EOAKeyDerivation.fixedMessage, "Argo key derivation v1")
    }

    func testSameSignatureAlwaysDerivesTheSameKEK() {
        let signature = "0x" + String(repeating: "ab", count: 65)
        let kek1 = EOAKeyDerivation.deriveKEK(fromSignature: signature)
        let kek2 = EOAKeyDerivation.deriveKEK(fromSignature: signature)
        XCTAssertEqual(kek1.rawData, kek2.rawData)
    }

    func testDifferentSignaturesDeriveDifferentKEKs() {
        let sigA = "0x" + String(repeating: "ab", count: 65)
        let sigB = "0x" + String(repeating: "cd", count: 65)
        let kekA = EOAKeyDerivation.deriveKEK(fromSignature: sigA)
        let kekB = EOAKeyDerivation.deriveKEK(fromSignature: sigB)
        XCTAssertNotEqual(kekA.rawData, kekB.rawData)
    }

    func testDerivedKEKIs256Bits() {
        let kek = EOAKeyDerivation.deriveKEK(fromSignature: "0xsig")
        XCTAssertEqual(kek.rawData.count, 32)
    }
}
