import XCTest
import CryptoKit
@testable import LuminaLog

private final class InMemorySecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}

final class ClientKeyEnrollerTests: XCTestCase {
    private func makeSUT(recovery: String = "AAAA-BBBB-CCCC-DDDD")
        -> (ClientKeyEnroller, InMemoryKeyMigrationTransport, InMemorySecretStore) {
        let transport = InMemoryKeyMigrationTransport()
        let store = InMemorySecretStore()
        let sut = ClientKeyEnroller(transport: transport, iCloudStore: store,
                              recoveryCodeFactory: { recovery })
        return (sut, transport, store)
    }

    func testHappyPathUploadsWrapsStoresICloudKEKReturnsCode() async throws {
        let (sut, transport, store) = makeSUT()
        let dek = SymmetricKey(size: .bits256)
        let code = try await sut.enroll(userId: "u1", dek: dek)
        XCTAssertEqual(code, "AAAA-BBBB-CCCC-DDDD")
        XCTAssertNotNil(transport.uploadedWraps)               // wraps uploaded
        XCTAssertNotNil(store.data(for: SyncedKeychainStore.account(forUserId: "u1"))) // iCloud KEK stored
        XCTAssertEqual(transport.finalizeMigrationCallCount, 0)        // NEVER finalizes in-app
    }

    func testAbortsBeforeFinalizeWhenICloudUnwrapMismatches() async throws {
        let (sut, transport, _) = makeSUT()
        transport.tamperICloudOnFetch = true              // fetched icloud wrap won't unwrap to dek
        do { _ = try await sut.enroll(userId: "u1", dek: SymmetricKey(size: .bits256)); XCTFail("expected verificationFailed") }
        catch KeyEnrollmentError.verificationFailed {}      // expected
        XCTAssertEqual(transport.finalizeMigrationCallCount, 0)
    }

    func testAbortsWhenRecoveryUnwrapMismatches() async throws {
        let (sut, transport, _) = makeSUT()
        transport.tamperRecoveryOnFetch = true
        do { _ = try await sut.enroll(userId: "u1", dek: SymmetricKey(size: .bits256)); XCTFail() }
        catch KeyEnrollmentError.verificationFailed {}
        XCTAssertEqual(transport.finalizeMigrationCallCount, 0)
    }

    /// The recovery-unlock path re-binds a recovered DEK to a FRESH iCloud KEK
    /// while keeping the code the user already holds valid.
    func testCallerSuppliedCodeIsReusedAndStillUnwraps() async throws {
        let (sut, transport, store) = makeSUT(recovery: "GENERATED-NEVER-USED")
        let dek = SymmetricKey(size: .bits256)
        let existing = "ZZZZ-YYYY-XXXX-WWWW"

        let code = try await sut.enroll(userId: "u1", dek: dek, code: existing)

        XCTAssertEqual(code, existing)  // did NOT mint a new code
        let fetched = try await transport.fetchWraps()
        let wraps = try XCTUnwrap(fetched)
        XCTAssertEqual(try RecoveryCode.unwrap(wraps.recovery, code: existing).rawData, dek.rawData)
        // …and the iCloud slot is bound to the freshly stored KEK for THIS device.
        let kek = SymmetricKey(data: try XCTUnwrap(store.data(for: SyncedKeychainStore.account(forUserId: "u1"))))
        XCTAssertEqual(try wraps.icloud.unwrapping(under: kek).rawData, dek.rawData)
    }
}
