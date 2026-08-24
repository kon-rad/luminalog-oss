import XCTest
@testable import LuminaLog

final class AnalyticsEventTests: XCTestCase {

    func testEventNamesMatchTheAgreedTaxonomy() {
        XCTAssertEqual(AnalyticsEvent.appOpened.name, "app_opened")
        XCTAssertEqual(AnalyticsEvent.onboardingCompleted.name, "onboarding_completed")
        XCTAssertEqual(AnalyticsEvent.entryCreated(kind: .text).name, "entry_created")
        XCTAssertEqual(AnalyticsEvent.insightViewed.name, "insight_viewed")
        XCTAssertEqual(AnalyticsEvent.chatMessageSent.name, "chat_message_sent")
        XCTAssertEqual(AnalyticsEvent.paywallShown(source: .settings).name, "paywall_shown")
        XCTAssertEqual(AnalyticsEvent.paywallDismissed(source: .settings).name, "paywall_dismissed")
        XCTAssertEqual(AnalyticsEvent.purchaseStarted(productId: "p").name, "purchase_started")
    }

    func testEntryCreatedCarriesOnlyTheKind() {
        for kind in [AnalyticsEvent.EntryKind.text, .voice, .video, .photo] {
            let props = AnalyticsEvent.entryCreated(kind: kind).properties
            XCTAssertEqual(props, ["kind": kind.rawValue])
        }
    }

    func testContentFreeEventsCarryNoProperties() {
        XCTAssertEqual(AnalyticsEvent.appOpened.properties, [:])
        XCTAssertEqual(AnalyticsEvent.onboardingCompleted.properties, [:])
        XCTAssertEqual(AnalyticsEvent.insightViewed.properties, [:])
        // The single most important assertion in this file. A word count, a
        // character count, or a title on this event would be journal content
        // leaving the device.
        XCTAssertEqual(AnalyticsEvent.chatMessageSent.properties, [:])
    }

    func testPaywallEventsCarryOnlyTheSource() {
        XCTAssertEqual(AnalyticsEvent.paywallShown(source: .voice).properties, ["source": "voice"])
        XCTAssertEqual(AnalyticsEvent.paywallDismissed(source: .chat).properties, ["source": "chat"])
    }

    func testPurchaseStartedCarriesOnlyTheProductId() {
        XCTAssertEqual(
            AnalyticsEvent.purchaseStarted(productId: "com.luminalog.pro.monthly").properties,
            ["product_id": "com.luminalog.pro.monthly"]
        )
    }

    func testPropertyKeysAreDrawnFromAClosedSet() {
        let allowed: Set<String> = ["kind", "source", "product_id"]
        let samples: [AnalyticsEvent] = [
            .appOpened, .onboardingCompleted, .entryCreated(kind: .voice), .insightViewed,
            .chatMessageSent, .paywallShown(source: .credits), .paywallDismissed(source: .credits),
            .purchaseStarted(productId: "p"),
        ]
        for event in samples {
            for key in event.properties.keys {
                XCTAssertTrue(allowed.contains(key), "unexpected analytics property key: \(key)")
            }
        }
    }
}
