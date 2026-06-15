import XCTest
import CryptoKit
@testable import LuminaLog

private final class InMemorySecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}

private final class StubKeyProvider: KeyProvider {
    let key: Data
    private(set) var fetchCount = 0
    init(key: Data) { self.key = key }
    func fetchDataKey(userId: String) async throws -> Data {
        fetchCount += 1
        return key
    }
}

@MainActor
final class UserKeyStoreTests: XCTestCase {

    private let rawKey = Data((0..<32).map { _ in UInt8.random(in: 0...255) })

    func testLoadFetchesAndCachesInSecretStore() async throws {
        let secrets = InMemorySecretStore()
        let provider = StubKeyProvider(key: rawKey)
        let store = UserKeyStore(provider: provider, secrets: secrets)

        let cipher = try await store.loadCipher(userId: "user-1")
        let envelope = try cipher.encrypt("hi", context: "c")
        XCTAssertEqual(try cipher.decrypt(envelope, context: "c"), "hi")
        XCTAssertEqual(provider.fetchCount, 1)
        XCTAssertNotNil(secrets.data(for: "dek.user-1"))
    }

    func testSecondLoadUsesSecretStoreNotProvider() async throws {
        let secrets = InMemorySecretStore()
        let provider = StubKeyProvider(key: rawKey)

        _ = try await UserKeyStore(provider: provider, secrets: secrets).loadCipher(userId: "user-1")
        // Fresh store instance, same secret store: must not hit the provider again.
        _ = try await UserKeyStore(provider: provider, secrets: secrets).loadCipher(userId: "user-1")
        XCTAssertEqual(provider.fetchCount, 1)
    }

    func testCurrentCipherNilBeforeLoad() {
        let store = UserKeyStore(provider: StubKeyProvider(key: rawKey),
                                 secrets: InMemorySecretStore())
        XCTAssertNil(store.currentCipher)
    }

    func testCurrentCipherAvailableAfterLoad() async throws {
        let store = UserKeyStore(provider: StubKeyProvider(key: rawKey),
                                 secrets: InMemorySecretStore())
        _ = try await store.loadCipher(userId: "user-1")
        XCTAssertNotNil(store.currentCipher)
        XCTAssertNotNil(store.currentDataKey)
    }

    func testSignOutClearsKey() async throws {
        let secrets = InMemorySecretStore()
        let store = UserKeyStore(provider: StubKeyProvider(key: rawKey), secrets: secrets)
        _ = try await store.loadCipher(userId: "user-1")
        store.signOut(userId: "user-1")
        XCTAssertNil(store.currentCipher)
        XCTAssertNil(secrets.data(for: "dek.user-1"))
    }
}
