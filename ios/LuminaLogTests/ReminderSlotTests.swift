import XCTest
@testable import LuminaLog

/// The shipped reminder catalog: the existing configurable 8 PM reminder plus
/// two fixed-time reminders (6 PM on, 10 PM on). Key stability matters — the
/// primary slot must reuse the legacy `ReminderPrefs` keys so an existing
/// user's setting survives.
final class ReminderSlotTests: XCTestCase {

    private func slot(_ id: String) -> ReminderSlot? {
        ReminderSlot.all.first { $0.id == id }
    }

    func testCatalogHasThreeSlots() {
        XCTAssertEqual(ReminderSlot.all.count, 3)
    }

    func testSlotIdentifiersAreUnique() {
        let ids = ReminderSlot.all.map(\.id)
        XCTAssertEqual(Set(ids).count, ids.count)
    }

    func testPrimarySlotReusesLegacyKeysAndIsOffByDefault() {
        let primary = slot("ll-daily-reminder")
        XCTAssertNotNil(primary)
        XCTAssertEqual(primary?.defaultHour, 20)
        XCTAssertEqual(primary?.defaultMinute, 0)
        XCTAssertFalse(primary?.defaultEnabled ?? true)
        XCTAssertTrue(primary?.timeEditable ?? false)
        XCTAssertEqual(primary?.enabledKey, ReminderPrefs.enabledKey)
        XCTAssertEqual(primary?.hourKey, ReminderPrefs.hourKey)
        XCTAssertEqual(primary?.minuteKey, ReminderPrefs.minuteKey)
    }

    func testEveningSlotIsSixPMOnByDefaultAndFixed() {
        let evening = slot("ll-reminder-evening")
        XCTAssertNotNil(evening)
        XCTAssertEqual(evening?.defaultHour, 18)
        XCTAssertEqual(evening?.defaultMinute, 0)
        XCTAssertTrue(evening?.defaultEnabled ?? false)
        XCTAssertFalse(evening?.timeEditable ?? true)
    }

    func testNightSlotIsTenPMOnByDefaultAndFixed() {
        let night = slot("ll-reminder-night")
        XCTAssertNotNil(night)
        XCTAssertEqual(night?.defaultHour, 22)
        XCTAssertEqual(night?.defaultMinute, 0)
        XCTAssertTrue(night?.defaultEnabled ?? false)
        XCTAssertFalse(night?.timeEditable ?? true)
    }

    func testFixedSlotsNamespaceTheirOwnPrefKeys() {
        let evening = slot("ll-reminder-evening")
        XCTAssertEqual(evening?.enabledKey, "ll-reminder-evening.enabled")
        XCTAssertEqual(evening?.hourKey, "ll-reminder-evening.hour")
        XCTAssertEqual(evening?.minuteKey, "ll-reminder-evening.minute")
    }
}
