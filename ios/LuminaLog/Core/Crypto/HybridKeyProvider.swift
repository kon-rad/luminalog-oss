import Foundation

/// Transitional `KeyProvider` for the zero-knowledge cutover window: tries the
/// `primary` provider (the iCloud-key path) and, only if it throws, falls back to
/// `fallback` (the legacy `/bootstrap` path). This lets a single app build serve BOTH
/// migrated users (iCloud path succeeds) and un-migrated users (iCloud path throws →
/// bootstrap). Once every account is migrated + finalized, the fallback and
/// `/bootstrap` are removed and `ICloudKeyProvider` stands alone.
///
/// Safety: the server refuses to *regenerate* a DEK for a migrated user (no
/// `wrappedDEK` but `wrappedKeys` present → error), so a post-finalize fallback fails
/// loud instead of minting a wrong key.
final class HybridKeyProvider: KeyProvider {

    private let primary: KeyProvider
    private let fallback: KeyProvider

    init(primary: KeyProvider, fallback: KeyProvider) {
        self.primary = primary
        self.fallback = fallback
    }

    func fetchDataKey(userId: String) async throws -> Data {
        do {
            return try await primary.fetchDataKey(userId: userId)
        } catch {
            return try await fallback.fetchDataKey(userId: userId)
        }
    }
}
