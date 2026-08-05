import Foundation
import CryptoKit

/// Fetches the raw per-user Data Encryption Key from the backend.
/// Stubbed by `MockKeyProvider` in previews/tests; `ProxyKeyProvider` in prod.
protocol KeyProvider: AnyObject {
    /// Returns the raw 32-byte DEK for the user, over an authenticated channel.
    func fetchDataKey(userId: String) async throws -> Data
}

enum UserKeyStoreError: LocalizedError {
    case invalidKeyLength

    var errorDescription: String? {
        switch self {
        case .invalidKeyLength: return "The encryption key was malformed."
        }
    }
}

/// Owns the device copy of the per-user DEK: loads it (Keychain first, then the
/// provider), caches it in memory, and vends a `FieldCipher`. The DEK is loaded
/// once right after sign-in, so `currentCipher` is available synchronously to
/// the Firestore mapping during snapshot decoding.
@MainActor
final class UserKeyStore {

    private let provider: KeyProvider
    private let secrets: SecretStore
    private var cachedCipher: FieldCipher?
    private var cachedKey: SymmetricKey?

    init(provider: KeyProvider, secrets: SecretStore) {
        self.provider = provider
        self.secrets = secrets
    }

    /// The cipher for the currently loaded user, or nil if none is loaded.
    var currentCipher: FieldCipher? { cachedCipher }

    /// The raw data key for media encryption, or nil if not loaded.
    var currentDataKey: SymmetricKey? { cachedKey }

    /// Load the DEK for `userId`, fetching from the provider only if it is not
    /// already in the Keychain. Idempotent.
    @discardableResult
    func loadCipher(userId: String) async throws -> FieldCipher {
        if let cachedCipher { return cachedCipher }

        let account = Self.account(for: userId)
        let raw: Data
        if let stored = secrets.data(for: account) {
            raw = stored
        } else {
            raw = try await provider.fetchDataKey(userId: userId)
            secrets.set(raw, for: account)
        }
        guard raw.count == 32 else { throw UserKeyStoreError.invalidKeyLength }

        let symmetricKey = SymmetricKey(data: raw)
        let cipher = FieldCipher(key: symmetricKey)
        cachedCipher = cipher
        cachedKey = symmetricKey
        return cipher
    }

    /// Adopt a DEK obtained OUTSIDE the provider — freshly enrolled for a new
    /// account, or recovered from the user's recovery code (`KeyEnrollmentService`).
    /// Caches it in memory and persists it to the device Keychain so later
    /// launches unlock straight from the cache.
    ///
    /// Callers MUST NOT call this until the DEK's wraps are uploaded and
    /// verified — installing first would let the user encrypt data with a key
    /// that has no durable backup.
    func install(dek: SymmetricKey, userId: String) {
        secrets.set(dek.rawData, for: Self.account(for: userId))
        cachedKey = dek
        cachedCipher = FieldCipher(key: dek)
    }

    /// Clear the in-memory cipher and the stored key for the user.
    func signOut(userId: String) {
        cachedCipher = nil
        cachedKey = nil
        secrets.remove(for: Self.account(for: userId))
    }

    private static func account(for userId: String) -> String { "dek.\(userId)" }
}
