import XCTest
@testable import LuminaLog

/// The structural half of the privacy guarantee. `AnalyticsEvent` makes it hard
/// to send the wrong payload; this makes it hard to bypass `AnalyticsEvent`
/// altogether by reaching for the SDK directly in a view. It scans the actual
/// source tree, so it fails on a new file that nobody thought to review.
final class AnalyticsImportGuardTests: XCTestCase {

    /// `<repo>/ios/LuminaLog`, derived from this file's path so the test does
    /// not depend on the simulator's working directory.
    private var appSourceRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // LuminaLogTests
            .deletingLastPathComponent()   // ios
            .appendingPathComponent("LuminaLog")
    }

    private func swiftFilesImportingPostHog() throws -> [URL] {
        let fm = FileManager.default
        guard let walker = fm.enumerator(at: appSourceRoot, includingPropertiesForKeys: nil) else {
            XCTFail("could not walk \(appSourceRoot.path)")
            return []
        }
        var hits: [URL] = []
        for case let url as URL in walker where url.pathExtension == "swift" {
            let source = try String(contentsOf: url, encoding: .utf8)
            if source.contains("import PostHog") { hits.append(url) }
        }
        return hits
    }

    func testPostHogIsImportedByExactlyOneFile() throws {
        let offenders = try swiftFilesImportingPostHog()
            .filter { $0.lastPathComponent != "Analytics.swift" }
            .map { $0.lastPathComponent }
            .sorted()
        XCTAssertEqual(
            offenders, [],
            "PostHog may only be imported by Analytics.swift. Route this through Analytics.capture(_:) instead."
        )
    }

    /// Without this, the guard above would pass vacuously the day someone
    /// removes the import from Analytics.swift.
    func testAnalyticsWrapperActuallyImportsTheSDK() throws {
        let importers = try swiftFilesImportingPostHog().map { $0.lastPathComponent }
        XCTAssertEqual(importers, ["Analytics.swift"])
    }

    /// Session replay on a journaling app's composer would upload the user's
    /// journal text to a vendor. Assert the flags stay off in source.
    func testSessionReplayAndAutocaptureStayDisabled() throws {
        let wrapper = appSourceRoot
            .appendingPathComponent("Core/Analytics/Analytics.swift")
        let source = try String(contentsOf: wrapper, encoding: .utf8)
        XCTAssertTrue(source.contains("sessionReplay = false"))
        XCTAssertTrue(source.contains("captureScreenViews = false"))
        XCTAssertTrue(source.contains("captureElementInteractions = false"))
    }

    /// The app must talk to Argo's own API, never to a PostHog host. A PostHog
    /// host here would add a tracking domain to the privacy manifest and put an
    /// ATT prompt in front of every user.
    func testAnalyticsHostIsArgosOwnAPI() {
        XCTAssertEqual(AppConfig.posthogHost, AppConfig.proxyBaseURL.appendingPathComponent("v1/ph"))
        XCTAssertFalse(AppConfig.posthogHost.absoluteString.contains("posthog"))
    }
}
