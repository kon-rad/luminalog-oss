import Foundation

/// App-wide configuration read from Info.plist keys.
enum AppConfig {

    /// Base URL of the LuminaLog proxy API (spec §4). Read from the
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
}
