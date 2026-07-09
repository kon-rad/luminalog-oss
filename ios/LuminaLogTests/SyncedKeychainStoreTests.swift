import XCTest
@testable import LuminaLog

// The real `SyncedKeychainStore` talks to the device Keychain (iCloud sync is
// verified in a later manual/integration pass). These unit tests validate the
// `SecretStore` *logic* it implements against an in-memory fake, mirroring the
// pattern in `UserKeyStoreTests`.
private final class InMemorySecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}

final class SyncedKeychainStoreTests: XCTestCase {

    func testAccountNamespacingPerUser() {
        XCTAssertEqual(SyncedKeychainStore.account(forUserId: "user-1"), "kek.icloud.user-1")
        XCTAssertNotEqual(
            SyncedKeychainStore.account(forUserId: "user-1"),
            SyncedKeychainStore.account(forUserId: "user-2")
        )
    }

    func testSecretStoreContractStoreLoadDelete() {
        let store: SecretStore = InMemorySecretStore()
        let account = SyncedKeychainStore.account(forUserId: "user-1")
        let kek = Data((0..<32).map { _ in UInt8.random(in: 0...255) })

        XCTAssertNil(store.data(for: account))
        store.set(kek, for: account)
        XCTAssertEqual(store.data(for: account), kek)
        store.remove(for: account)
        XCTAssertNil(store.data(for: account))
    }

    func testRealKeychainRoundTrip() throws {
        // Exercises the ACTUAL SyncedKeychainStore against the Keychain, catching the
        // classic footgun where a synchronizable item must also carry
        // kSecAttrSynchronizable on read/delete to find what it wrote. If the test
        // host lacks Keychain entitlements (some CI/sim setups), skip rather than
        // fail — live iCloud sync/escrow remains a separate manual pass.
        let store = SyncedKeychainStore()
        let account = SyncedKeychainStore.account(forUserId: "kc-roundtrip-\(UInt32.random(in: 0...UInt32.max))")
        let kek = Data((0..<32).map { _ in UInt8.random(in: 0...255) })

        do {
            try store.store(kek, for: account)
        } catch SyncedKeychainError.writeFailed(let status) where status == errSecMissingEntitlement || status == -34018 {
            throw XCTSkip("Keychain unavailable in this test environment (OSStatus \(status)).")
        }
        // Read back through the store's own synchronizable query.
        XCTAssertEqual(store.data(for: account), kek, "synchronizable read must find the written item")
        try store.removeChecked(for: account)
        XCTAssertNil(store.data(for: account), "delete must remove the synchronizable item")
    }

    func testOverwriteReplacesExistingKEK() throws {
        let store = SyncedKeychainStore()
        let account = SyncedKeychainStore.account(forUserId: "kc-overwrite-\(UInt32.random(in: 0...UInt32.max))")
        let first = Data(repeating: 0xA1, count: 32)
        let second = Data(repeating: 0xB2, count: 32)
        do {
            try store.store(first, for: account)
        } catch SyncedKeychainError.writeFailed(let status) where status == errSecMissingEntitlement || status == -34018 {
            throw XCTSkip("Keychain unavailable in this test environment (OSStatus \(status)).")
        }
        try store.store(second, for: account)
        XCTAssertEqual(store.data(for: account), second, "second write must overwrite the first")
        try store.removeChecked(for: account)
    }
}
