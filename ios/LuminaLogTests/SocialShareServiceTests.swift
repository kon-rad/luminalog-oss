import XCTest
import UIKit
@testable import LuminaLog

final class SocialShareServiceTests: XCTestCase {

    /// A real 1×1 image so `pngData()` is non-nil (an empty `UIImage()` encodes to nil).
    private func tinyImage() -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 1, height: 1)).image { ctx in
            UIColor.red.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 1, height: 1))
        }
    }

    func testInstagramStoriesDeepLink() {
        XCTAssertEqual(SocialPlatform.instagramStories.appURL(caption: "x").absoluteString,
                       "instagram://story-camera")
    }

    func testInstagramPostDeepLink() {
        XCTAssertEqual(SocialPlatform.instagramPost.appURL(caption: "x").absoluteString,
                       "instagram://camera")
    }

    func testLinkedInDeepLink() {
        XCTAssertEqual(SocialPlatform.linkedIn.appURL(caption: "x").absoluteString, "linkedin://")
    }

    func testFacebookDeepLink() {
        XCTAssertEqual(SocialPlatform.facebook.appURL(caption: "x").absoluteString, "fb://")
    }

    func testXDeepLinkEncodesCaption() {
        let url = SocialPlatform.x.appURL(caption: "hi there #Argo")
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        XCTAssertEqual(comps.scheme, "twitter")
        XCTAssertEqual(comps.host, "post")
        XCTAssertEqual(comps.queryItems?.first(where: { $0.name == "message" })?.value,
                       "hi there #Argo")
    }

    func testXWebFallbackEncodesCaption() {
        let url = SocialPlatform.x.webFallbackURL(caption: "hello world")
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        XCTAssertEqual(comps.host, "twitter.com")
        XCTAssertEqual(comps.path, "/intent/tweet")
        XCTAssertEqual(comps.queryItems?.first(where: { $0.name == "text" })?.value, "hello world")
    }

    func testFacebookWebFallback() {
        XCTAssertEqual(SocialPlatform.facebook.webFallbackURL(caption: "x").absoluteString,
                       "https://www.facebook.com")
    }

    func testResolvedURLPrefersAppWhenInstalled() {
        let svc = SocialShareService()
        XCTAssertEqual(svc.resolvedURL(for: .facebook, caption: "x", isAppInstalled: true).absoluteString,
                       "fb://")
    }

    func testResolvedURLUsesWebWhenNotInstalled() {
        let svc = SocialShareService()
        XCTAssertEqual(svc.resolvedURL(for: .facebook, caption: "x", isAppInstalled: false).absoluteString,
                       "https://www.facebook.com")
    }

    func testShareRoutesThroughInjectedClosures() {
        var opened: URL?
        let svc = SocialShareService(canOpen: { _ in false }, open: { opened = $0 })
        svc.share(.linkedIn, caption: "x")
        XCTAssertEqual(opened?.absoluteString, "https://www.linkedin.com")
    }

    // MARK: - Instagram Stories pasteboard share

    func testInstagramStoriesShareOpensShareURLAndSetsBackgroundImage() {
        var opened: URL?
        var pastedItems: [[String: Any]] = []
        var pasteOptions: [UIPasteboard.OptionsKey: Any] = [:]
        let svc = SocialShareService(
            canOpen: { _ in true },
            open: { opened = $0 },
            setPasteboardItems: { items, options in pastedItems = items; pasteOptions = options }
        )

        let launched = svc.shareToInstagramStories(image: tinyImage(), facebookAppID: "1234567890")

        XCTAssertTrue(launched)
        XCTAssertEqual(opened?.absoluteString,
                       "instagram-stories://share?source_application=1234567890")
        XCTAssertNotNil(pastedItems.first?[SocialShareService.instagramBackgroundImageKey],
                        "the rendered card must be handed to Instagram, not left to the camera roll")
        XCTAssertNotNil(pasteOptions[.expirationDate])
    }

    func testInstagramStoriesShareFallsBackWithoutFacebookAppID() {
        var opened: URL?
        var pasted = false
        let svc = SocialShareService(canOpen: { _ in true },
                                     open: { opened = $0 },
                                     setPasteboardItems: { _, _ in pasted = true })
        XCTAssertFalse(svc.shareToInstagramStories(image: tinyImage(), facebookAppID: nil))
        XCTAssertFalse(svc.shareToInstagramStories(image: tinyImage(), facebookAppID: ""))
        XCTAssertNil(opened)
        XCTAssertFalse(pasted)
    }

    func testInstagramStoriesShareFallsBackWhenInstagramMissing() {
        var opened: URL?
        var pasted = false
        let svc = SocialShareService(canOpen: { _ in false },
                                     open: { opened = $0 },
                                     setPasteboardItems: { _, _ in pasted = true })
        XCTAssertFalse(svc.shareToInstagramStories(image: tinyImage(), facebookAppID: "123"))
        XCTAssertNil(opened)
        XCTAssertFalse(pasted)
    }

    func testAllPlatformsHaveLabels() {
        for p in SocialPlatform.allCases {
            XCTAssertFalse(p.displayName.isEmpty)
            XCTAssertFalse(p.accessibilityName.isEmpty)
        }
    }
}
