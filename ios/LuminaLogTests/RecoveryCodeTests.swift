import XCTest
import CryptoKit
@testable import LuminaLog

final class RecoveryCodeTests: XCTestCase {

    // MARK: - Generation

    func testGeneratedCodeShapeAndAlphabet() {
        let code = RecoveryCode.generate()
        // 256 bits → 52 base32 chars → 13 groups of 4 joined by "-".
        let groups = code.split(separator: "-")
        XCTAssertEqual(groups.count, 13)
        XCTAssertTrue(groups.allSatisfy { $0.count == 4 })

        let payload = code.replacingOccurrences(of: "-", with: "")
        XCTAssertEqual(payload.count, 52)
        let allowed = Set(RecoveryCode.alphabet)
        XCTAssertTrue(payload.allSatisfy { allowed.contains($0) })
        // No ambiguous glyphs ever appear in a generated code.
        XCTAssertFalse(payload.contains(where: { "ILOU".contains($0) }))
    }

    func testGeneratedCodesAreUnique() {
        let codes = (0..<200).map { _ in RecoveryCode.generate() }
        XCTAssertEqual(Set(codes).count, codes.count)
    }

    // MARK: - Normalization

    func testNormalizationIsSeparatorAndCaseInsensitive() {
        let canonical = "ABCD2345"
        XCTAssertEqual(RecoveryCode.normalize("abcd-2345"), canonical)
        XCTAssertEqual(RecoveryCode.normalize("ab cd 23 45"), canonical)
        XCTAssertEqual(RecoveryCode.normalize("AbCd-2345"), canonical)
    }

    func testNormalizationMapsAmbiguousGlyphs() {
        // O→0, I→1, L→1, U→V
        XCTAssertEqual(RecoveryCode.normalize("OILU"), "011V")
    }

    func testDeriveKEKIsCaseAndSeparatorInsensitive() {
        let a = RecoveryCode.deriveKEK(from: "ABCD-2345-WXYZ")
        let b = RecoveryCode.deriveKEK(from: "abcd2345wxyz")
        let c = RecoveryCode.deriveKEK(from: "abcd 2345 wxyz")
        XCTAssertEqual(a.rawData, b.rawData)
        XCTAssertEqual(a.rawData, c.rawData)
    }

    func testDifferentCodesDeriveDifferentKEKs() {
        let a = RecoveryCode.deriveKEK(from: "AAAA-AAAA")
        let b = RecoveryCode.deriveKEK(from: "AAAA-AAAB")
        XCTAssertNotEqual(a.rawData, b.rawData)
    }

    // MARK: - HKDF known-answer (parameters pinned)

    func testHKDFMatchesIndependentComputation() {
        // Independently recompute HKDF with the exact pinned salt/info so any
        // drift in the derivation parameters is caught. This is deterministic:
        // the same code must always produce this exact key.
        let code = "XMFT-9K2P-QRS7"
        let normalized = RecoveryCode.normalize(code)
        let expected = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: Data(normalized.utf8)),
            salt: Data("luminalog-recovery-kek-salt-v1".utf8),
            info: Data("luminalog-recovery-kek-v1".utf8),
            outputByteCount: 32
        )
        XCTAssertEqual(RecoveryCode.deriveKEK(from: code).rawData, expected.rawData)
        XCTAssertEqual(RecoveryCode.deriveKEK(from: code).rawData.count, 32)
    }

    // MARK: - Wrap / unwrap

    func testWrapUnwrapRoundTrip() throws {
        let dek = SymmetricKey(size: .bits256)
        let code = RecoveryCode.generate()
        let wrap = RecoveryCode.wrap(dek: dek, code: code)
        let opened = try RecoveryCode.unwrap(wrap, code: code)
        XCTAssertEqual(opened.rawData, dek.rawData)
    }

    func testUnwrapWithFormattingVariantOfSameCode() throws {
        let dek = SymmetricKey(size: .bits256)
        let code = "ABCD-2345-WXYZ"
        let wrap = RecoveryCode.wrap(dek: dek, code: code)
        // Re-entered lowercase, no dashes: must still unwrap.
        let opened = try RecoveryCode.unwrap(wrap, code: "abcd2345wxyz")
        XCTAssertEqual(opened.rawData, dek.rawData)
    }

    func testWrongCodeFailsClosed() throws {
        let dek = SymmetricKey(size: .bits256)
        let wrap = RecoveryCode.wrap(dek: dek, code: "ABCD-2345")
        XCTAssertThrowsError(try RecoveryCode.unwrap(wrap, code: "ZZZZ-9999"))
    }
}
