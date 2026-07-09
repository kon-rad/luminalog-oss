import XCTest
import CryptoKit
@testable import LuminaLog

final class LocalKeyProviderTests: XCTestCase {

    func testGenerateDEKIs256Bit() {
        let dek = LocalKeyProvider().generateDEK()
        XCTAssertEqual(dek.rawData.count, 32)
    }

    func testGeneratedDEKsAreDistinct() {
        let provider = LocalKeyProvider()
        XCTAssertNotEqual(provider.generateDEK().rawData, provider.generateDEK().rawData)
    }

    func testOpenViaICloudKEK() throws {
        let provider = LocalKeyProvider()
        let dek = provider.generateDEK()
        let iCloudKEK = SymmetricKey(size: .bits256)
        let code = RecoveryCode.generate()

        let wraps = provider.wrap(dek: dek, iCloudKEK: iCloudKEK, recoveryCode: code)
        let opened = try provider.open(wraps, iCloudKEK: iCloudKEK)
        XCTAssertEqual(opened.rawData, dek.rawData)
    }

    func testOpenViaRecoveryCode() throws {
        let provider = LocalKeyProvider()
        let dek = provider.generateDEK()
        let iCloudKEK = SymmetricKey(size: .bits256)
        let code = RecoveryCode.generate()

        let wraps = provider.wrap(dek: dek, iCloudKEK: iCloudKEK, recoveryCode: code)
        let opened = try provider.open(wraps, recoveryCode: code)
        XCTAssertEqual(opened.rawData, dek.rawData)
    }

    func testEitherKEKYieldsIdenticalDEK() throws {
        let provider = LocalKeyProvider()
        let dek = provider.generateDEK()
        let iCloudKEK = SymmetricKey(size: .bits256)
        let code = RecoveryCode.generate()
        let wraps = provider.wrap(dek: dek, iCloudKEK: iCloudKEK, recoveryCode: code)

        let viaICloud = try provider.open(wraps, iCloudKEK: iCloudKEK)
        let viaRecovery = try provider.open(wraps, recoveryCode: code)
        XCTAssertEqual(viaICloud.rawData, viaRecovery.rawData)
        XCTAssertEqual(viaICloud.rawData, dek.rawData)
    }

    func testOpenPrefersAvailableMaterial() throws {
        let provider = LocalKeyProvider()
        let dek = provider.generateDEK()
        let iCloudKEK = SymmetricKey(size: .bits256)
        let code = RecoveryCode.generate()
        let wraps = provider.wrap(dek: dek, iCloudKEK: iCloudKEK, recoveryCode: code)

        // Only iCloud KEK available.
        XCTAssertEqual(
            try provider.open(wraps, iCloudKEK: iCloudKEK, recoveryCode: nil).rawData,
            dek.rawData
        )
        // Only recovery code available.
        XCTAssertEqual(
            try provider.open(wraps, iCloudKEK: nil, recoveryCode: code).rawData,
            dek.rawData
        )
        // Wrong iCloud KEK but valid recovery code still opens.
        XCTAssertEqual(
            try provider.open(wraps, iCloudKEK: SymmetricKey(size: .bits256), recoveryCode: code).rawData,
            dek.rawData
        )
    }

    func testMissingBothKEKsFailsClosed() {
        let provider = LocalKeyProvider()
        let dek = provider.generateDEK()
        let wraps = provider.wrap(dek: dek, iCloudKEK: SymmetricKey(size: .bits256),
                                  recoveryCode: RecoveryCode.generate())
        XCTAssertThrowsError(try provider.open(wraps, iCloudKEK: nil, recoveryCode: nil)) {
            XCTAssertEqual($0 as? LocalKeyProviderError, .noKeyMaterial)
        }
    }

    func testWrongMaterialFailsClosed() {
        let provider = LocalKeyProvider()
        let dek = provider.generateDEK()
        let wraps = provider.wrap(dek: dek, iCloudKEK: SymmetricKey(size: .bits256),
                                  recoveryCode: RecoveryCode.generate())
        // Both supplied but both wrong.
        XCTAssertThrowsError(
            try provider.open(wraps, iCloudKEK: SymmetricKey(size: .bits256),
                              recoveryCode: "ZZZZ-0000")
        )
    }

    func testMultiWrapFirestoreRoundTrip() throws {
        let provider = LocalKeyProvider()
        let dek = provider.generateDEK()
        let iCloudKEK = SymmetricKey(size: .bits256)
        let code = RecoveryCode.generate()
        let wraps = provider.wrap(dek: dek, iCloudKEK: iCloudKEK, recoveryCode: code)

        let decoded = try XCTUnwrap(MultiWrappedDEK(data: wraps.firestoreData))
        XCTAssertEqual(decoded, wraps)
        XCTAssertEqual(try provider.open(decoded, iCloudKEK: iCloudKEK).rawData, dek.rawData)
    }

    func testFetchDataKeyIsNotWiredAndFailsClosed() async {
        // KeyProvider conformance exists, but the live path is disabled in 1a.
        do {
            _ = try await LocalKeyProvider().fetchDataKey(userId: "user-1")
            XCTFail("Expected .notWired")
        } catch {
            XCTAssertEqual(error as? LocalKeyProviderError, .notWired)
        }
    }

    func testConformsToKeyProvider() {
        let _: KeyProvider = LocalKeyProvider()
    }
}
