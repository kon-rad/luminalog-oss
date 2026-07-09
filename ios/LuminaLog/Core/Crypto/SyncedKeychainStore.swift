import Foundation
import Security

/// Surfaced when a Keychain operation on the critical iCloud KEK fails, so a lost
/// write is never silently swallowed (a dropped KEK = the user cannot unlock).
enum SyncedKeychainError: LocalizedError {
    case writeFailed(OSStatus)
    case deleteFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .writeFailed(let s): return "Keychain KEK write failed (OSStatus \(s))."
        case .deleteFailed(let s): return "Keychain KEK delete failed (OSStatus \(s))."
        }
    }
}

/// iCloud-Keychain-backed `SecretStore` for the **iCloud KEK** (spec §2).
///
/// Unlike `KeychainStore` (device-local DEK cache, `…ThisDeviceOnly`), this store
/// marks items `kSecAttrSynchronizable = true` so the KEK syncs end-to-end across
/// the user's Apple devices via iCloud Keychain. A synchronizable item cannot be
/// `…ThisDeviceOnly`, so accessibility is `kSecAttrAccessibleAfterFirstUnlock`;
/// Face ID / passcode is layered separately as an app-level `BiometricGate`, not
/// as this item's ACL.
///
/// NOTE: Real iCloud sync + escrow behavior is exercised in a later manual /
/// integration pass on device — unit tests validate the `SecretStore` *logic*
/// against `InMemorySecretStore`, not the live Keychain.
final class SyncedKeychainStore: SecretStore {

    private let service = "com.konradgnat.luminalog.kek"

    /// Canonical account name for a user's iCloud KEK.
    static func account(forUserId userId: String) -> String { "kek.icloud.\(userId)" }

    func data(for account: String) -> Data? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else {
            return nil
        }
        return result as? Data
    }

    func set(_ data: Data, for account: String) {
        // `SecretStore` conformance is non-throwing. Callers that must not lose the
        // KEK (the migration/unlock path) use the throwing `store(_:for:)` instead;
        // here we surface a failure loudly in debug rather than silently no-op.
        do { try store(data, for: account) }
        catch { assertionFailure("SyncedKeychainStore write failed: \(error)") }
    }

    func remove(for account: String) {
        try? removeChecked(for: account)
    }

    /// Throwing write for the critical KEK path — surfaces a failed `SecItemAdd`
    /// instead of dropping the key. Overwrites any existing item for `account`.
    func store(_ data: Data, for account: String) throws {
        try removeChecked(for: account)
        var query = baseQuery(account: account)
        query[kSecValueData as String] = data
        // Synchronizable items MUST NOT be ThisDeviceOnly.
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw SyncedKeychainError.writeFailed(status) }
    }

    /// Throwing delete that tolerates "not found" but surfaces real failures.
    func removeChecked(for account: String) throws {
        let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SyncedKeychainError.deleteFailed(status)
        }
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            // Enrolls the item in iCloud Keychain sync.
            kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
        ]
    }
}
