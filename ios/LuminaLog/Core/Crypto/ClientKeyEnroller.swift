import Foundation
import CryptoKit

enum KeyEnrollmentError: LocalizedError {
    case verificationFailed

    var errorDescription: String? {
        switch self {
        case .verificationFailed: return "Key safety check failed; nothing was changed."
        }
    }
}

/// Binds a DEK to the two client-held KEKs: a fresh random key in the iCloud
/// Keychain and one derived from a printable recovery code. Uploads both wraps
/// and VERIFIES they unwrap back to the same DEK before returning the recovery
/// code for display.
///
/// Serves both key lifecycles:
/// - **first-run enrollment** — a brand-new account's freshly generated DEK
///   (`KeyEnrollmentService`), and
/// - **recovery-code unlock** — re-binding a recovered DEK to a fresh KEK on a
///   new device.
///
/// It never deletes the legacy server wrap and never finalizes a migration —
/// that is the separate, guarded server step.
final class ClientKeyEnroller {
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

    /// Wrap `dek` under a fresh iCloud KEK + a recovery code, upload both wraps,
    /// and prove both recover `dek`. Returns the recovery code to display.
    ///
    /// Throws `verificationFailed` (having deleted nothing and finalized nothing)
    /// if either wrap cannot be proven to recover `dek` — so callers must not
    /// install the DEK until this returns successfully.
    ///
    /// `code` overrides the generated recovery code so the unlock path can
    /// re-bind a recovered DEK to a new device WITHOUT invalidating the code the
    /// user already holds (same code ⇒ same `KEK_recovery`).
    @discardableResult
    func enroll(userId: String, dek: SymmetricKey, code: String? = nil) async throws -> String {
        // 1. Fresh iCloud KEK → iCloud Keychain.
        let iCloudKEK = SymmetricKey(size: .bits256)
        let account = SyncedKeychainStore.account(forUserId: userId)
        iCloudStore.set(iCloudKEK.rawData, for: account)

        // 2. Recovery code — the one the user already holds, or a new one.
        let recoveryCode = code ?? recoveryCodeFactory()

        // 3. Wrap the dek under both, upload.
        let wraps = local.wrap(dek: dek, iCloudKEK: iCloudKEK, recoveryCode: recoveryCode)
        try await transport.uploadWraps(wraps)

        // 4. VERIFY GATE — re-fetch and prove BOTH unwrap back to the same DEK,
        //    reading the KEK BACK from the iCloud Keychain (not the in-memory copy).
        guard let fetched = try await transport.fetchWraps() else {
            throw KeyEnrollmentError.verificationFailed
        }
        guard let storedKEKData = iCloudStore.data(for: account) else {
            throw KeyEnrollmentError.verificationFailed
        }
        let storedKEK = SymmetricKey(data: storedKEKData)

        let viaICloud = try? local.open(fetched, iCloudKEK: storedKEK)
        let viaRecovery = try? local.open(fetched, recoveryCode: recoveryCode)
        guard
            let viaICloud, viaICloud.rawData == dek.rawData,
            let viaRecovery, viaRecovery.rawData == dek.rawData
        else {
            throw KeyEnrollmentError.verificationFailed
        }

        return recoveryCode
    }
}
