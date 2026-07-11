import Foundation

/// Persists pre-auth onboarding state: a completion flag (so the flow shows
/// once per install) and the buffered answers (`[fieldKey: value]`), which are
/// merged into the profile after sign-in.
@MainActor
final class OnboardingStore {

    static let completedKey = "ll-onboarding-completed"
    private static let draftKey = "ll-onboarding-draft"
    /// Buffered public-Soul NFT consent answered pre-auth (nil until the user answers
    /// the "Your public Soul" step). Recorded to the profile at the post-sign-in merge.
    private static let soulConsentKey = "ll-onboarding-soul-consent"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var isCompleted: Bool { defaults.bool(forKey: Self.completedKey) }
    func markCompleted() { defaults.set(true, forKey: Self.completedKey) }

    /// The user's answer to the public-Soul consent step, or nil if not yet answered.
    var pendingSoulConsent: Bool? { defaults.object(forKey: Self.soulConsentKey) as? Bool }
    func setPendingSoulConsent(_ granted: Bool) { defaults.set(granted, forKey: Self.soulConsentKey) }
    func clearPendingSoulConsent() { defaults.removeObject(forKey: Self.soulConsentKey) }

    func loadDraft() -> [String: String] {
        guard let data = defaults.data(forKey: Self.draftKey),
              let dict = try? JSONDecoder().decode([String: String].self, from: data)
        else { return [:] }
        return dict
    }

    func saveDraft(_ draft: [String: String]) {
        guard let data = try? JSONEncoder().encode(draft) else { return }
        defaults.set(data, forKey: Self.draftKey)
    }

    func clearDraft() { defaults.removeObject(forKey: Self.draftKey) }
}
