import Foundation

/// App-wide configuration flags.
enum AppConfig {

    /// True when a `GoogleService-Info.plist` is bundled with the app.
    ///
    /// The real plist is never committed to source control. When it is absent
    /// the app runs in **demo mode**: Firebase is not configured and all
    /// services fall back to local mocks.
    static let isFirebaseConfigured: Bool =
        Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil
}
