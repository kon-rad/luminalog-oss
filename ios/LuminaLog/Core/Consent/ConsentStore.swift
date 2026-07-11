import Foundation

/// Owns the local record of the user's AI-data-sharing consent
/// (App Store 5.1.1/5.1.2). The UserDefaults flag is the client-side gating
/// source of truth; `needsServerSync` tracks whether it has been mirrored to
/// the server via `PUT /v1/consent`.
final class ConsentStore {
    static let version = "2026-07-11"
    private static let flagKey = "ll-consent-ai-v1"
    private static let syncedKey = "ll-consent-ai-v1-synced"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var hasConsentedAI: Bool { defaults.bool(forKey: Self.flagKey) }

    /// Local consent recorded but not yet confirmed written to the server.
    var needsServerSync: Bool { hasConsentedAI && !defaults.bool(forKey: Self.syncedKey) }

    func recordLocalConsent() {
        defaults.set(true, forKey: Self.flagKey)
        defaults.set(false, forKey: Self.syncedKey)
    }

    func markSynced() { defaults.set(true, forKey: Self.syncedKey) }
}
