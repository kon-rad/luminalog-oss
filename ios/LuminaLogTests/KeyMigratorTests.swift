import XCTest
import CryptoKit
@testable import LuminaLog

private final class InMemorySecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}

final class KeyMigratorTests: XCTestCase {
    private func makeSUT(recovery: String = "AAAA-BBBB-CCCC-DDDD")
        -> (KeyMigrator, InMemoryKeyMigrationTransport, InMemorySecretStore) {
        let transport = InMemoryKeyMigrationTransport()
        let store = InMemorySecretStore()
        let sut = KeyMigrator(transport: transport, iCloudStore: store,
                              recoveryCodeFactory: { recovery })
        return (sut, transport, store)
    }

    func testHappyPathUploadsWrapsStoresICloudKEKReturnsCode() async throws {
        let (sut, transport, store) = makeSUT()
        let dek = SymmetricKey(size: .bits256)
        let code = try await sut.migrate(userId: "u1", dek: dek)
        XCTAssertEqual(code, "AAAA-BBBB-CCCC-DDDD")
        XCTAssertNotNil(transport.uploadedWraps)               // wraps uploaded
        XCTAssertNotNil(store.data(for: SyncedKeychainStore.account(forUserId: "u1"))) // iCloud KEK stored
        XCTAssertEqual(transport.finalizeMigrationCallCount, 0)        // NEVER finalizes in-app
    }

    func testAbortsBeforeFinalizeWhenICloudUnwrapMismatches() async throws {
        let (sut, transport, _) = makeSUT()
        transport.tamperICloudOnFetch = true              // fetched icloud wrap won't unwrap to dek
        do { _ = try await sut.migrate(userId: "u1", dek: SymmetricKey(size: .bits256)); XCTFail("expected verificationFailed") }
        catch KeyMigrationError.verificationFailed {}      // expected
        XCTAssertEqual(transport.finalizeMigrationCallCount, 0)
    }

    func testAbortsWhenRecoveryUnwrapMismatches() async throws {
        let (sut, transport, _) = makeSUT()
        transport.tamperRecoveryOnFetch = true
        do { _ = try await sut.migrate(userId: "u1", dek: SymmetricKey(size: .bits256)); XCTFail() }
        catch KeyMigrationError.verificationFailed {}
        XCTAssertEqual(transport.finalizeMigrationCallCount, 0)
    }
}
