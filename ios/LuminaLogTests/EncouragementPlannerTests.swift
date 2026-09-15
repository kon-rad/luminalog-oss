import XCTest
@testable import LuminaLog

final class EncouragementPlannerTests: XCTestCase {

    private let utc = TimeZone(identifier: "UTC")!

    private func date(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.timeZone = TimeZone(identifier: "UTC")
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)!
    }

    private func message(_ id: String, _ timeOfDay: TimeOfDay, created: Date) -> EncouragementMessage {
        EncouragementMessage(id: id, timeOfDay: timeOfDay, text: "T-\(id)", createdAt: created, deliveredAt: nil)
    }

    func testAssignsEachSlotItsMatchingTimeOfDayMessage() {
        let now = date("2026-08-24T05:00:00Z")
        let today = [
            message("m", .morning, created: now),
            message("a", .afternoon, created: now),
            message("e", .evening, created: now),
        ]

        let plan = EncouragementPlanner.plan(now: now, today: today, slots: EncouragementSlot.all, timezone: utc)

        XCTAssertEqual(plan.count, 3)
        XCTAssertEqual(plan.map(\.message.id), ["m", "a", "e"])
        XCTAssertEqual(plan.map(\.slotId), EncouragementSlot.all.map(\.id))
        XCTAssertEqual(plan[0].fireDate, date("2026-08-24T09:00:00Z"))
        XCTAssertEqual(plan[1].fireDate, date("2026-08-24T13:00:00Z"))
        XCTAssertEqual(plan[2].fireDate, date("2026-08-24T16:00:00Z"))
    }

    func testSkipsSlotsThatHaveAlreadyPassedToday() {
        let now = date("2026-08-24T14:00:00Z")
        let today = [
            message("m", .morning, created: now),
            message("a", .afternoon, created: now),
            message("e", .evening, created: now),
        ]

        let plan = EncouragementPlanner.plan(now: now, today: today, slots: EncouragementSlot.all, timezone: utc)

        XCTAssertEqual(plan.count, 1)
        XCTAssertEqual(plan[0].slotId, EncouragementSlot.all[2].id)
        XCTAssertEqual(plan[0].message.id, "e")
        XCTAssertEqual(plan[0].fireDate, date("2026-08-24T16:00:00Z"))
    }

    func testReturnsNothingWhenEverySlotHasPassed() {
        let now = date("2026-08-24T23:00:00Z")
        let today = [message("m", .morning, created: now)]

        XCTAssertTrue(EncouragementPlanner.plan(now: now, today: today, slots: EncouragementSlot.all, timezone: utc).isEmpty)
    }

    func testOmitsASlotWithNoMatchingTimeOfDayMessage() {
        let now = date("2026-08-24T05:00:00Z")
        // Only morning and evening were generated; afternoon had nothing to ground it in.
        let today = [message("m", .morning, created: now), message("e", .evening, created: now)]

        let plan = EncouragementPlanner.plan(now: now, today: today, slots: EncouragementSlot.all, timezone: utc)

        XCTAssertEqual(plan.map(\.slotId), [EncouragementSlot.all[0].id, EncouragementSlot.all[2].id])
    }

    func testHonoursTheUsersTimezoneNotUTC() {
        let warsaw = TimeZone(identifier: "Europe/Warsaw")!  // UTC+2 in August
        let now = date("2026-08-24T03:00:00Z")               // 05:00 local
        let today = [message("m", .morning, created: now)]

        let plan = EncouragementPlanner.plan(now: now, today: today, slots: EncouragementSlot.all, timezone: warsaw)

        // 09:00 Warsaw is 07:00 UTC.
        XCTAssertEqual(plan[0].fireDate, date("2026-08-24T07:00:00Z"))
    }
}
