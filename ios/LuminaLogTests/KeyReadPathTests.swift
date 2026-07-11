import XCTest
import CryptoKit
@testable import LuminaLog

/// Tests the zero-knowledge read path: `ICloudKeyProvider` (loads the DEK from the
/// iCloud key + server wraps) and `HybridKeyProvider` (iCloud path, else bootstrap).
final class KeyReadPathTests: XCTestCase {

    /// Local secret store for the iCloud-KEK slot (fileprivate to avoid clashing with
    /// the copies in other test files).
    fileprivate final class FakeSecretStore: SecretStore {
        private var items: [String: Data] = [:]
        func data(for account: String) -> Data? { items[account] }
        func set(_ data: Data, for account: String) { items[account] = data }
        func remove(for account: String) { items[account] = nil }
    }

    fileprivate final class FakeKeyProvider: KeyProvider {
        let result: Result<Data, Error>
        private(set) var calls = 0
        init(_ result: Result<Data, Error>) { self.result = result }
        func fetchDataKey(userId: String) async throws -> Data {
            calls += 1
            return try result.get()
        }
    }

    private struct Boom: Error {}

    // MARK: - ICloudKeyProvider

    func testICloudProviderReturnsDEKFromKeyAndWraps() async throws {
        let dek = SymmetricKey(size: .bits256)
        let kek = SymmetricKey(size: .bits256)
        let store = FakeSecretStore()
        store.set(kek.rawData, for: SyncedKeychainStore.account(forUserId: "u1"))
        let transport = InMemoryKeyMigrationTransport()
        try await transport.uploadWraps(MultiWrappedDEK(
            icloud: WrappedKey.wrapping(dek: dek, under: kek),
            recovery: RecoveryCode.wrap(dek: dek, code: "AAAA-BBBB-CCCC-DDDD")
        ))
        let sut = ICloudKeyProvider(iCloudStore: store, transport: transport)

        let got = try await sut.fetchDataKey(userId: "u1")
        XCTAssertEqual(got, dek.rawData)
    }

    func testICloudProviderThrowsWhenNoKeyInKeychain() async throws {
        let transport = InMemoryKeyMigrationTransport()
        let sut = ICloudKeyProvider(iCloudStore: FakeSecretStore(), transport: transport)
        do { _ = try await sut.fetchDataKey(userId: "u1"); XCTFail("expected noICloudKey") }
        catch ICloudKeyProviderError.noICloudKey {}
    }

    func testICloudProviderThrowsWhenNoWraps() async throws {
        let store = FakeSecretStore()
        store.set(SymmetricKey(size: .bits256).rawData, for: SyncedKeychainStore.account(forUserId: "u1"))
        let sut = ICloudKeyProvider(iCloudStore: store, transport: InMemoryKeyMigrationTransport())
        do { _ = try await sut.fetchDataKey(userId: "u1"); XCTFail("expected noWraps") }
        catch ICloudKeyProviderError.noWraps {}
    }

    func testICloudProviderThrowsOnWrongKey() async throws {
        let dek = SymmetricKey(size: .bits256)
        let store = FakeSecretStore()
        // Store a DIFFERENT KEK than the wrap was made under → unwrap must fail closed.
        store.set(SymmetricKey(size: .bits256).rawData, for: SyncedKeychainStore.account(forUserId: "u1"))
        let transport = InMemoryKeyMigrationTransport()
        try await transport.uploadWraps(MultiWrappedDEK(
            icloud: WrappedKey.wrapping(dek: dek, under: SymmetricKey(size: .bits256)),
            recovery: RecoveryCode.wrap(dek: dek, code: "AAAA-BBBB-CCCC-DDDD")
        ))
        let sut = ICloudKeyProvider(iCloudStore: store, transport: transport)
        do { _ = try await sut.fetchDataKey(userId: "u1"); XCTFail("expected throw on wrong key") }
        catch { /* any error is acceptable — fails closed */ }
    }
    // The legacy HybridKeyProvider / ProxyKeyProvider (/bootstrap) fallback was deleted
    // at the zero-knowledge cutover — ICloudKeyProvider is the sole key path now.
}
