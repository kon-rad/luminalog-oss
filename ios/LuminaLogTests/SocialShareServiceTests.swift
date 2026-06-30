import XCTest
@testable import LuminaLog

final class SocialShareServiceTests: XCTestCase {

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
        let url = SocialPlatform.x.appURL(caption: "hi there #LuminaLog")
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        XCTAssertEqual(comps.scheme, "twitter")
        XCTAssertEqual(comps.host, "post")
        XCTAssertEqual(comps.queryItems?.first(where: { $0.name == "message" })?.value,
                       "hi there #LuminaLog")
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

    func testAllPlatformsHaveLabels() {
        for p in SocialPlatform.allCases {
            XCTAssertFalse(p.displayName.isEmpty)
            XCTAssertFalse(p.accessibilityName.isEmpty)
        }
    }
}
