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
    static let aiModel1Key = "ll-ai-model1"
    static let zkMigrationKey = "ll-zk-migration"

    /// Selects the zero-knowledge AI path. When ON the client decrypts context
    /// locally and sends it as PLAINTEXT to the AI endpoints, and — because the
    /// server no longer persists chat messages — persists + re-encrypts chat
    /// messages CLIENT-SIDE via the existing encrypting repository.
    ///
    /// Registered ON for EVERY build (see LuminaLogApp.init). Post-cutover this is
    /// the ONLY path: the legacy server-decrypt architecture (MASTER_KEY, server
    /// DEK, the non-ZK route bodies) was deleted server-side (ADR-0073), so turning
    /// this OFF would break AI features. It is no longer a dev toggle — kept as a
    /// flag only until the client-side legacy-path cleanup lands.
    static var aiModel1: Bool {
        get { UserDefaults.standard.bool(forKey: aiModel1Key) }
        set { UserDefaults.standard.set(newValue, forKey: aiModel1Key) }
    }

    /// Gates the one-time in-app zero-knowledge migration prompt (phase 1d).
    /// OFF by default → the prompt never appears and no key handoff runs. Flip ON
    /// per build to migrate the founder accounts; the whole path is deleted after
    /// the one-time cutover.
    static var zkMigration: Bool {
        get { UserDefaults.standard.bool(forKey: zkMigrationKey) }
        set { UserDefaults.standard.set(newValue, forKey: zkMigrationKey) }
    }

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

extension Notification.Name {
    /// Posted after a daily report is successfully generated and saved (by the
    /// milestone flow or the DEBUG-only developer tool), so Home's Daily
    /// Reflections feed reloads and the new card appears. Reports persist to
    /// Firestore the same way regardless of how generation was triggered.
    static let dailyReportGenerated = Notification.Name("ll-daily-report-generated")
}
