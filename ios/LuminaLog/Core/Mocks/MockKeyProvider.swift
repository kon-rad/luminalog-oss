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
