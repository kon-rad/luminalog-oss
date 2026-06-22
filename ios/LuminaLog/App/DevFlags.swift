import Foundation

/// Developer-only flags for bypassing paywalls, credits, and onboarding during
/// local development. Values are persisted in UserDefaults so they survive
/// restarts and can be toggled without rebuilding.
///
/// In debug builds the app registers `devMode = true` as the default
/// (see LuminaLogApp.init), so the paywall and credit gates are off out of the
/// box. Set `UserDefaults.standard.set(false, forKey: DevFlags.devModeKey)`
/// (or toggle in a debug menu) to re-enable them.
enum DevFlags {

    static let devModeKey = "ll-dev-mode"
    static let forceOnboardingKey = "ll-force-onboarding"

    /// When true the paywall, credit balance check, and credit deduction are
    /// all skipped. Intended for local dev; has no effect in release if never
    /// set (UserDefaults returns false for unknown keys).
    static var devMode: Bool {
        UserDefaults.standard.bool(forKey: devModeKey)
    }

    /// When true onboarding is always shown on sign-out; when false it is
    /// never shown. Overrides the normal `ll-onboarding-completed` flag.
    static var forceOnboarding: Bool {
        get { UserDefaults.standard.bool(forKey: forceOnboardingKey) }
        set { UserDefaults.standard.set(newValue, forKey: forceOnboardingKey) }
    }
}
