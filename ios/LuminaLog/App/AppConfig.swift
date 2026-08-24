import Foundation

/// App-wide configuration read from Info.plist keys.
enum AppConfig {

    /// Base URL of the Argo proxy API (spec §4). Read from the
    /// `LUMINALOG_API_URL` Info.plist key; defaults to local development.
    static let proxyBaseURL: URL = {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "LUMINALOG_API_URL") as? String,
           !raw.isEmpty,
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "http://localhost:3200")!
    }()

    /// RevenueCat public SDK key from the `REVENUECAT_API_KEY` Info.plist key.
    /// When absent, the subscription service falls back to the mock.
    static let revenueCatAPIKey: String? = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "REVENUECAT_API_KEY") as? String,
              !raw.isEmpty else { return nil }
        return raw
    }()

    /// Facebook (Meta) App ID used as Instagram Stories' `source_application`
    /// (required since Jan 2023). Read from the `FACEBOOK_APP_ID` Info.plist key,
    /// supplied by `Local.xcconfig`. When absent, Stories sharing falls back to
    /// opening the story camera instead of injecting the rendered card. Not a
    /// secret — an FB App ID is a public, client-side value.
    static let facebookAppID: String? = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "FACEBOOK_APP_ID") as? String,
              !raw.isEmpty else { return nil }
        return raw
    }()

    /// PostHog public project API key, from the `POSTHOG_API_KEY` Info.plist key
    /// supplied by `Local.xcconfig`. Write-only and public by design, exactly
    /// like the RevenueCat key. When absent, `Analytics` never starts and the
    /// app sends nothing.
    static let posthogAPIKey: String? = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "POSTHOG_API_KEY") as? String,
              !raw.isEmpty else { return nil }
        return raw
    }()

    /// PostHog ingestion host: always Argo's own API, never PostHog's.
    ///
    /// This one line is why the app ships with `NSPrivacyTracking = false`, an
    /// empty `NSPrivacyTrackingDomains`, and no App Tracking Transparency
    /// prompt. Pointing it at a PostHog host would add a tracking domain to the
    /// privacy manifest and change the App Store privacy label. Do not change it.
    static let posthogHost: URL = proxyBaseURL.appendingPathComponent("v1/ph")
}
