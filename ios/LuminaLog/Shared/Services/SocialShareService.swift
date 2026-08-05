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
    /// Injected so the Instagram Stories pasteboard hand-off is testable without
    /// touching the real `UIPasteboard`.
    var setPasteboardItems: ([[String: Any]], [UIPasteboard.OptionsKey: Any]) -> Void = {
        UIPasteboard.general.setItems($0, options: $1)
    }

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

    /// Pasteboard key Instagram reads to load a story's full-screen background.
    static let instagramBackgroundImageKey = "com.instagram.sharedSticker.backgroundImage"

    /// Shares an image straight into the Instagram Stories composer via Instagram's
    /// documented pasteboard API: the PNG is placed on the pasteboard under
    /// `com.instagram.sharedSticker.backgroundImage`, then `instagram-stories://share`
    /// is opened so Instagram loads *that exact image*. This is what makes the shared
    /// story match the card the app just rendered — the old flow (`instagram://story-camera`)
    /// only opened the camera, leaving the user to pick a possibly-stale card from Photos.
    ///
    /// Requires a Facebook App ID for `source_application` (mandatory since Jan 2023;
    /// without it Instagram shows "…doesn't currently support sharing to Stories").
    /// Returns `false` — launching nothing — when the App ID is missing, the image
    /// can't be encoded, or Instagram isn't installed, so the caller can fall back.
    @discardableResult
    func shareToInstagramStories(image: UIImage, facebookAppID: String?) -> Bool {
        guard let appID = facebookAppID, !appID.isEmpty,
              let data = image.pngData(),
              let url = URL(string: "instagram-stories://share?source_application=\(appID)"),
              canOpen(url) else { return false }

        let items: [[String: Any]] = [[Self.instagramBackgroundImageKey: data]]
        let options: [UIPasteboard.OptionsKey: Any] = [
            // Instagram must read the pasteboard within this window; 5 min per Meta's docs.
            .expirationDate: Date().addingTimeInterval(60 * 5)
        ]
        setPasteboardItems(items, options)
        open(url)
        return true
    }
}
