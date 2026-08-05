import Foundation
import CryptoKit

/// Deterministic `KeyProvider` for previews and unit tests: derives a stable
/// 32-byte key from the userId so encrypted data round-trips within a session.
final class MockKeyProvider: KeyProvider {

    func fetchDataKey(userId: String) async throws -> Data {
        let digest = SHA256.hash(data: Data("luminalog-mock-dek.\(userId)".utf8))
        return Data(digest)   // SHA-256 → exactly 32 bytes
    }
}

/// In-memory `KeyMigrationTransport` for previews and mock wiring, where there is
/// no `ProxyAPIClient` to talk to. `MockKeyProvider` always vends a key, so
/// `KeyEnrollmentService` resolves to `.unlocked` without ever reaching this.
final class MockKeyMigrationTransport: KeyMigrationTransport {
    private var wraps: MultiWrappedDEK?

    func uploadWraps(_ wraps: MultiWrappedDEK) async throws { self.wraps = wraps }
    func fetchWraps() async throws -> MultiWrappedDEK? { wraps }
    func finalizeMigration() async throws {}
}
