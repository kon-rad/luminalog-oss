import UIKit

/// The social destinations offered on the Daily Report Card share bar.
///
/// Each platform resolves to a deep link that opens the native app's composer
/// (so the just-saved card is waiting at the top of the camera roll) and a web
/// fallback used when the app isn't installed. Only X accepts prefilled text via
/// its URL; the other apps ignore the caption.
enum SocialPlatform: String, CaseIterable, Identifiable {
    case instagramStories
    case instagramPost
    case x
    case linkedIn
    case facebook

    var id: String { rawValue }

    /// Short label shown under the brand tile.
    var displayName: String {
        switch self {
        case .instagramStories: return "Stories"
        case .instagramPost:    return "Post"
        case .x:                return "X"
        case .linkedIn:         return "LinkedIn"
        case .facebook:         return "Facebook"
        }
    }

    /// Full spoken label for VoiceOver.
    var accessibilityName: String {
        switch self {
        case .instagramStories: return "Share to Instagram Stories"
        case .instagramPost:    return "Share to Instagram post"
        case .x:                return "Share to X"
        case .linkedIn:         return "Share to LinkedIn"
        case .facebook:         return "Share to Facebook"
        }
    }

    /// Deep link into the installed app's composer.
    func appURL(caption: String) -> URL {
        switch self {
        case .instagramStories:
            return URL(string: "instagram://story-camera")!
        case .instagramPost:
            return URL(string: "instagram://camera")!
        case .x:
            var c = URLComponents()
            c.scheme = "twitter"
            c.host = "post"
            c.queryItems = [URLQueryItem(name: "message", value: caption)]
            return c.url!
        case .linkedIn:
            return URL(string: "linkedin://")!
        case .facebook:
            return URL(string: "fb://")!
        }
    }

    /// Opened in Safari when the native app isn't installed.
    func webFallbackURL(caption: String) -> URL {
        switch self {
        case .instagramStories, .instagramPost:
            return URL(string: "https://www.instagram.com")!
        case .x:
            var c = URLComponents()
            c.scheme = "https"
            c.host = "twitter.com"
            c.path = "/intent/tweet"
            c.queryItems = [URLQueryItem(name: "text", value: caption)]
            return c.url!
        case .linkedIn:
            return URL(string: "https://www.linkedin.com")!
        case .facebook:
            return URL(string: "https://www.facebook.com")!
        }
    }
}

/// Resolves a `SocialPlatform` to the right URL (app vs web) and opens it.
/// The install check and open side effects are injected so the routing logic is
/// unit-testable without `UIApplication`.
struct SocialShareService {
    var canOpen: (URL) -> Bool = { UIApplication.shared.canOpenURL($0) }
    var open: (URL) -> Void = { UIApplication.shared.open($0) }

    /// Pure routing: app URL when installed, otherwise the web fallback.
    func resolvedURL(for platform: SocialPlatform, caption: String, isAppInstalled: Bool) -> URL {
        isAppInstalled
            ? platform.appURL(caption: caption)
            : platform.webFallbackURL(caption: caption)
    }

    /// Opens the platform, choosing app vs web based on what's installed.
    func share(_ platform: SocialPlatform, caption: String) {
        let installed = canOpen(platform.appURL(caption: caption))
        open(resolvedURL(for: platform, caption: caption, isAppInstalled: installed))
    }
}
