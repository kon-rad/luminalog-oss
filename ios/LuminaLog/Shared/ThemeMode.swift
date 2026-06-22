import SwiftUI

/// App-owned appearance preference. Unlike "follow the system", an explicit
/// `.light` / `.dark` choice overrides iOS's scheduled/automatic dark mode so the
/// app does not flip appearance on the OS's nightly schedule.
///
/// Persisted as a raw `String` under `storageKey` via `@AppStorage`, matching the
/// app's existing string/scalar preference convention (see `ReminderPrefs`,
/// `DevFlags`). Convert with `ThemeMode(rawValue:)` to apply.
enum ThemeMode: String, CaseIterable, Identifiable {
    case light
    case dark
    case system

    /// `@AppStorage` key. The `ll-` prefix matches every other LuminaLog default.
    static let storageKey = "ll-theme-mode"

    /// Legacy boolean key this setting replaces (`true` == forced dark).
    private static let legacyForceDarkKey = "ll-force-dark"

    var id: String { rawValue }

    /// Scheme to hand to `.preferredColorScheme`. `system` returns `nil` so SwiftUI
    /// defers to the OS appearance (the only mode that auto-switches).
    var colorScheme: ColorScheme? {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }

    /// Human label for the Settings picker.
    var label: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }

    /// One-time upgrade from the legacy `ll-force-dark` boolean. Runs at most once:
    /// if the new key is already set, it is a no-op. Preserves prior behavior —
    /// forced-dark users become `.dark`; everyone else becomes `.system` (and keeps
    /// following the OS until they explicitly choose). Clears the legacy key after.
    static func migrateLegacyIfNeeded(_ defaults: UserDefaults = .standard) {
        guard defaults.string(forKey: storageKey) == nil else { return }

        // `bool(forKey:)` returns false for an absent key, which maps to `.system` —
        // exactly the desired default for users who never touched the old toggle.
        let migrated: ThemeMode = defaults.bool(forKey: legacyForceDarkKey) ? .dark : .system
        defaults.set(migrated.rawValue, forKey: storageKey)
        defaults.removeObject(forKey: legacyForceDarkKey)
    }
}
