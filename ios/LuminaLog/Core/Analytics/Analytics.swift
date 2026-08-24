import Foundation
import PostHog

/// The ONLY file in the app that imports PostHog. Everything else goes through
/// `Analytics.capture(_:)`, which accepts the closed `AnalyticsEvent` enum and
/// nothing else. `AnalyticsImportGuardTests` fails if a second import appears.
///
/// Every capture flag that could sweep up on-screen content is off:
/// autocapture, element interactions, screen views, and session replay. In a
/// journaling app those are not conveniences, they are content exfiltration.
/// Session replay on the entry composer would upload the user's journal text to
/// a vendor. Do not turn any of them on.
enum Analytics {

    private static var started = false

    /// Starts the SDK if a key is configured. Safe to call more than once, and
    /// a no-op in any build without `POSTHOG_API_KEY`, which includes every
    /// developer checkout that has not filled in `Local.xcconfig`.
    static func start() {
        guard !started, let key = AppConfig.posthogAPIKey else { return }
        let config = PostHogConfig(apiKey: key, host: AppConfig.posthogHost.absoluteString)
        config.captureApplicationLifecycleEvents = false
        config.captureScreenViews = false
        config.captureElementInteractions = false
        config.sessionReplay = false
        PostHogSDK.shared.setup(config)
        started = true
    }

    /// Ties events to the Firebase uid, which is already declared as a linked
    /// UserID for app functionality and is the same key the server's RevenueCat
    /// forwarder uses, so subscription events join the product event stream.
    static func identify(uid: String) {
        guard started, !uid.isEmpty else { return }
        PostHogSDK.shared.identify(uid)
    }

    /// Called on sign-out so the next account on this device is a new identity.
    static func reset() {
        guard started else { return }
        PostHogSDK.shared.reset()
    }

    static func capture(_ event: AnalyticsEvent) {
        guard started else { return }
        PostHogSDK.shared.capture(event.name, properties: event.properties)
    }
}
