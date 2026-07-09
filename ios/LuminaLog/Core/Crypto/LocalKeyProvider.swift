import Foundation
import CryptoKit

enum LocalKeyProviderError: LocalizedError {
    /// No usable key material (neither a valid iCloud KEK nor a valid recovery
    /// code) was supplied — fail closed rather than return a zero/garbage key.
    case noKeyMaterial
    /// `fetchDataKey` is a `KeyProvider` conformance point only; the local key
    /// path is NOT wired into the live app in phase 1a (cutover is phase 1d).
    case notWired

    var errorDescription: String? {
        switch self {
        case .noKeyMaterial: return "No key material was available to unlock your data."
        case .notWired: return "Local key provider is not enabled."
        }
    }
}

/// The set of wraps of a single DEK, one per KEK. Uploaded to
/// `users/{uid}.wrappedKeys` (spec §2). The server stores ciphertext it cannot
/// open, since it never holds `KEK_icloud` or the recovery code.
struct MultiWrappedDEK: Equatable {
    let icloud: WrappedKey
    let recovery: WrappedKey

    var firestoreData: [String: Any] {
        [
            "icloud": icloud.firestoreData,
            "recovery": recovery.firestoreData,
        ]
    }

    init(icloud: WrappedKey, recovery: WrappedKey) {
        self.icloud = icloud
        self.recovery = recovery
    }

    init?(data: Any?) {
        guard
            let dict = data as? [String: Any],
            let icloud = WrappedKey(data: dict["icloud"]),
            let recovery = WrappedKey(data: dict["recovery"])
        else { return nil }
        self.icloud = icloud
        self.recovery = recovery
    }
}

/// Client-side key provider: generates the DEK on-device and assembles / opens
/// the multi-wrap. Conforms to `KeyProvider` so it can drop in for
/// `ProxyKeyProvider` behind a flag at cutover — but it is **not wired into
/// `AppServices` in phase 1a**. No network, fail-closed throughout.
final class LocalKeyProvider: KeyProvider {

    /// Generate a fresh 256-bit DEK on-device.
    func generateDEK() -> SymmetricKey { SymmetricKey(size: .bits256) }

    /// Wrap a DEK under both the iCloud KEK and the recovery code.
    func wrap(dek: SymmetricKey, iCloudKEK: SymmetricKey, recoveryCode: String) -> MultiWrappedDEK {
        MultiWrappedDEK(
            icloud: WrappedKey.wrapping(dek: dek, under: iCloudKEK),
            recovery: RecoveryCode.wrap(dek: dek, code: recoveryCode)
        )
    }

    /// Open the DEK using the iCloud KEK (primary unlock path).
    func open(_ wraps: MultiWrappedDEK, iCloudKEK: SymmetricKey) throws -> SymmetricKey {
        try wraps.icloud.unwrapping(under: iCloudKEK)
    }

    /// Open the DEK using the recovery code (backstop path).
    func open(_ wraps: MultiWrappedDEK, recoveryCode: String) throws -> SymmetricKey {
        try RecoveryCode.unwrap(wraps.recovery, code: recoveryCode)
    }

    /// Open with whichever material is available, trying the iCloud KEK first,
    /// then the recovery code. Fails closed if neither yields the DEK.
    func open(
        _ wraps: MultiWrappedDEK,
        iCloudKEK: SymmetricKey?,
        recoveryCode: String?
    ) throws -> SymmetricKey {
        if let iCloudKEK, let dek = try? wraps.icloud.unwrapping(under: iCloudKEK) {
            return dek
        }
        if let recoveryCode, let dek = try? RecoveryCode.unwrap(wraps.recovery, code: recoveryCode) {
            return dek
        }
        throw LocalKeyProviderError.noKeyMaterial
    }

    // MARK: - KeyProvider

    /// Conformance point only. The local key path is not enabled in phase 1a;
    /// wiring happens at the gated cutover (phase 1d). Fails closed.
    func fetchDataKey(userId: String) async throws -> Data {
        throw LocalKeyProviderError.notWired
    }
}
