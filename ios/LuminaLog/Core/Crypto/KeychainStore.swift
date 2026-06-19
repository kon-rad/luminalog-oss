import Foundation
import Security

/// Minimal secret persistence. A protocol so unit tests use an in-memory fake
/// instead of the real Keychain.
protocol SecretStore: AnyObject {
    func data(for account: String) -> Data?
    func set(_ data: Data, for account: String)
    func remove(for account: String)
}

/// Keychain-backed `SecretStore`. Items are device-only and available after
/// first unlock so background work (e.g. notifications) can still decrypt.
final class KeychainStore: SecretStore {

    private let service = "com.konradgnat.luminalog.keys"

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
        remove(for: account)
        var query = baseQuery(account: account)
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    func remove(for account: String) {
        SecItemDelete(baseQuery(account: account) as CFDictionary)
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
