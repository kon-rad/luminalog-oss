import Foundation
import CryptoKit

enum ICloudKeyProviderError: LocalizedError {
    /// No `KEK_icloud` in this device's iCloud Keychain — the user hasn't migrated on
    /// any of their devices, or the synced item hasn't arrived yet.
    case noICloudKey
    /// The server holds no client wraps for this user (not migrated).
    case noWraps

    var errorDescription: String? {
        switch self {
        case .noICloudKey: return "No iCloud recovery key is available on this device."
        case .noWraps: return "No client-held key wraps are stored for this account."
        }
    }
}

/// `KeyProvider` for the zero-knowledge read path: loads the DEK by reading
/// `KEK_icloud` from the iCloud Keychain, fetching the user's `wrappedKeys` from the
/// server, and unwrapping the iCloud wrap. Used as the PRIMARY provider in the
/// migration window (via `HybridKeyProvider`), falling back to `/bootstrap` for
/// un-migrated users; after the cutover it becomes the sole provider.
///
/// Fails closed: any missing KEK / missing wraps / unwrap failure throws, so the
/// caller can fall back (pre-finalize) rather than proceed with a bad key.
final class ICloudKeyProvider: KeyProvider {

    private let iCloudStore: SecretStore
    private let transport: KeyMigrationTransport
    private let local = LocalKeyProvider()

    init(iCloudStore: SecretStore, transport: KeyMigrationTransport) {
        self.iCloudStore = iCloudStore
        self.transport = transport
    }

    func fetchDataKey(userId: String) async throws -> Data {
        let account = SyncedKeychainStore.account(forUserId: userId)
        guard let kekData = iCloudStore.data(for: account), kekData.count == 32 else {
            throw ICloudKeyProviderError.noICloudKey
        }
        let kek = SymmetricKey(data: kekData)
        guard let wraps = try await transport.fetchWraps() else {
            throw ICloudKeyProviderError.noWraps
        }
        // Throws on a tag mismatch (wrong KEK / tampered wrap) — fail closed.
        let dek = try local.open(wraps, iCloudKEK: kek)
        return dek.rawData
    }
}
