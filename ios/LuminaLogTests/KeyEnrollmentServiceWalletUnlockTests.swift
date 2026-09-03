import XCTest
import CryptoKit
@testable import LuminaLog

/// `KeyEnrollmentService.submitWalletUnlock`: unlock via the connected wallet's
/// signature over the fixed key-wrap message (spec §6.2 step 7), always failing
/// closed on any mismatch.
final class KeyEnrollmentServiceWalletUnlockTests: XCTestCase {

    private final class StubEOAWrapTransport: EOAWrapTransport {
        var wrapToReturn: WrappedKey?
        func uploadEOAWrap(_ wrap: WrappedKey) async throws { wrapToReturn = wrap }
        func fetchEOAWrap() async throws -> WrappedKey? { wrapToReturn }
    }

    private final class InMemorySecretStore: SecretStore {
        private var storage: [String: Data] = [:]
        func data(for account: String) -> Data? { storage[account] }
        func set(_ data: Data, for account: String) { storage[account] = data }
        func remove(for account: String) { storage[account] = nil }
    }

    @MainActor
    private func makeSUT() -> (
        KeyEnrollmentService, StubEOAWrapTransport, MockWalletConnectService, UserKeyStore
    ) {
        let migrationTransport = InMemoryKeyMigrationTransport()
        let eoaTransport = StubEOAWrapTransport()
        let wallet = MockWalletConnectService()
        let keys = UserKeyStore(provider: MockKeyProvider(), secrets: InMemorySecretStore())
        let enroller = ClientKeyEnroller(
            transport: migrationTransport,
            iCloudStore: InMemorySecretStore()
        )
        let sut = KeyEnrollmentService(keys: keys, enroller: enroller, transport: migrationTransport)
        return (sut, eoaTransport, wallet, keys)
    }

    @MainActor
    func testSubmitWalletUnlockInstallsDEKOnSuccessfulUnwrap() async throws {
        let (sut, eoaTransport, wallet, keys) = makeSUT()
        let dek = SymmetricKey(size: .bits256)
        let signature = "0xfixedsig"
        wallet.signatureToReturn = signature
        let kek = EOAKeyDerivation.deriveKEK(fromSignature: signature)
        eoaTransport.wrapToReturn = WrappedKey.wrapping(dek: dek, under: kek)

        await sut.submitWalletUnlock(userId: "u1", wallet: wallet, eoaTransport: eoaTransport)

        XCTAssertEqual(sut.state, .unlocked)
        XCTAssertEqual(keys.currentDataKey?.rawData, dek.rawData)
    }

    @MainActor
    func testSubmitWalletUnlockFailsClosedWhenNoEoaWrapExists() async throws {
        let (sut, eoaTransport, wallet, _) = makeSUT()
        eoaTransport.wrapToReturn = nil

        await sut.submitWalletUnlock(userId: "u1", wallet: wallet, eoaTransport: eoaTransport)

        if case .failed = sut.state {} else {
            XCTFail("expected .failed, got \(sut.state)")
        }
    }

    @MainActor
    func testSubmitWalletUnlockFailsClosedOnWrongSignature() async throws {
        let (sut, eoaTransport, wallet, _) = makeSUT()
        let dek = SymmetricKey(size: .bits256)
        let realKEK = EOAKeyDerivation.deriveKEK(fromSignature: "0xrealsig")
        eoaTransport.wrapToReturn = WrappedKey.wrapping(dek: dek, under: realKEK)
        wallet.signatureToReturn = "0xdifferentsig" // simulates a different wallet/account connected

        await sut.submitWalletUnlock(userId: "u1", wallet: wallet, eoaTransport: eoaTransport)

        if case .needsRecoveryCode(let failedAttempt) = sut.state {
            XCTAssertTrue(failedAttempt)
        } else {
            XCTFail("expected .needsRecoveryCode(failedAttempt: true), got \(sut.state)")
        }
    }
}
