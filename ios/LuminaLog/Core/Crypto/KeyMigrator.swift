import Foundation
import CryptoKit

enum KeyMigrationError: LocalizedError {
    case verificationFailed

    var errorDescription: String? {
        switch self {
        case .verificationFailed: return "Migration safety check failed; nothing was changed."
        }
    }
}

/// One-time, temporary. Re-wraps the EXISTING DEK under a fresh iCloud-Keychain KEK
/// and a recovery code, uploads the wraps, and VERIFIES both unwrap back to the same
/// DEK before returning the recovery code for display. It never deletes the legacy
/// server wrap and never finalizes — that is the separate, guarded server step.
final class KeyMigrator {
    private let transport: KeyMigrationTransport
    private let iCloudStore: SecretStore
    private let recoveryCodeFactory: () -> String
    private let local = LocalKeyProvider()

    init(
        transport: KeyMigrationTransport,
        iCloudStore: SecretStore,
        recoveryCodeFactory: @escaping () -> String = { RecoveryCode.generate() }
    ) {
        self.transport = transport
        self.iCloudStore = iCloudStore
        self.recoveryCodeFactory = recoveryCodeFactory
    }

    /// Returns the recovery code to display. Throws `verificationFailed` (and deletes
    /// nothing, never finalizes) if either wrap cannot be proven to recover `dek`.
    func migrate(userId: String, dek: SymmetricKey) async throws -> String {
        // 1. Fresh iCloud KEK → iCloud Keychain.
        let iCloudKEK = SymmetricKey(size: .bits256)
        let account = SyncedKeychainStore.account(forUserId: userId)
        iCloudStore.set(iCloudKEK.rawData, for: account)

        // 2. Recovery code.
        let code = recoveryCodeFactory()

        // 3. Wrap the EXISTING dek under both, upload.
        let wraps = local.wrap(dek: dek, iCloudKEK: iCloudKEK, recoveryCode: code)
        try await transport.uploadWraps(wraps)

        // 4. VERIFY GATE — re-fetch and prove BOTH unwrap back to the same DEK,
        //    reading the KEK BACK from the iCloud Keychain (not the in-memory copy).
        guard let fetched = try await transport.fetchWraps() else {
            throw KeyMigrationError.verificationFailed
        }
        guard let storedKEKData = iCloudStore.data(for: account) else {
            throw KeyMigrationError.verificationFailed
        }
        let storedKEK = SymmetricKey(data: storedKEKData)

        let viaICloud = try? local.open(fetched, iCloudKEK: storedKEK)
        let viaRecovery = try? local.open(fetched, recoveryCode: code)
        guard
            let viaICloud, viaICloud.rawData == dek.rawData,
            let viaRecovery, viaRecovery.rawData == dek.rawData
        else {
            throw KeyMigrationError.verificationFailed
        }

        return code
    }
}
