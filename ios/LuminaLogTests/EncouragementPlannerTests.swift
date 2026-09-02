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

    private func message(_ id: String, created: Date) -> EncouragementMessage {
        EncouragementMessage(id: id, title: "T-\(id)", body: "B-\(id)", createdAt: created, deliveredAt: nil)
    }

    func testAssignsThreeOldestMessagesToTheThreeSlotsInOrder() {
        let now = date("2026-08-24T05:00:00Z")
        let queue = [
            message("a", created: date("2026-08-22T05:00:00Z")),
            message("b", created: date("2026-08-23T05:00:00Z")),
            message("c", created: date("2026-08-24T05:00:00Z")),
            message("d", created: date("2026-08-24T05:00:01Z")),
        ]

        let plan = EncouragementPlanner.plan(now: now, queue: queue, slots: EncouragementSlot.all, timezone: utc)

        XCTAssertEqual(plan.count, 3)
        XCTAssertEqual(plan.map(\.message.id), ["a", "b", "c"])
        XCTAssertEqual(plan.map(\.slotId), EncouragementSlot.all.map(\.id))
        XCTAssertEqual(plan[0].fireDate, date("2026-08-24T09:00:00Z"))
        XCTAssertEqual(plan[1].fireDate, date("2026-08-24T13:00:00Z"))
        XCTAssertEqual(plan[2].fireDate, date("2026-08-24T16:00:00Z"))
    }

    func testSkipsSlotsThatHaveAlreadyPassedToday() {
        let now = date("2026-08-24T14:00:00Z")
        let queue = [
            message("a", created: date("2026-08-24T05:00:00Z")),
            message("b", created: date("2026-08-24T05:00:01Z")),
            message("c", created: date("2026-08-24T05:00:02Z")),
        ]

        let plan = EncouragementPlanner.plan(now: now, queue: queue, slots: EncouragementSlot.all, timezone: utc)

        XCTAssertEqual(plan.count, 1)
        XCTAssertEqual(plan[0].slotId, EncouragementSlot.all[2].id)
        XCTAssertEqual(plan[0].message.id, "a")
        XCTAssertEqual(plan[0].fireDate, date("2026-08-24T16:00:00Z"))
    }

    func testReturnsNothingWhenEverySlotHasPassed() {
        let now = date("2026-08-24T23:00:00Z")
        let queue = [message("a", created: date("2026-08-24T05:00:00Z"))]

        XCTAssertTrue(EncouragementPlanner.plan(now: now, queue: queue, slots: EncouragementSlot.all, timezone: utc).isEmpty)
    }

    func testAssignsOnlyAsManyMessagesAsTheQueueHolds() {
        let now = date("2026-08-24T05:00:00Z")
        let queue = [message("a", created: date("2026-08-24T05:00:00Z"))]

        let plan = EncouragementPlanner.plan(now: now, queue: queue, slots: EncouragementSlot.all, timezone: utc)

        XCTAssertEqual(plan.count, 1)
        XCTAssertEqual(plan[0].slotId, EncouragementSlot.all[0].id)
    }

    func testIgnoresAlreadyDeliveredMessages() {
        let now = date("2026-08-24T05:00:00Z")
        var delivered = message("done", created: date("2026-08-23T05:00:00Z"))
        delivered.deliveredAt = date("2026-08-23T09:00:00Z")
        let queue = [delivered, message("fresh", created: date("2026-08-24T05:00:00Z"))]

        let plan = EncouragementPlanner.plan(now: now, queue: queue, slots: EncouragementSlot.all, timezone: utc)

        XCTAssertEqual(plan.count, 1)
        XCTAssertEqual(plan[0].message.id, "fresh")
    }

    func testHonoursTheUsersTimezoneNotUTC() {
        let warsaw = TimeZone(identifier: "Europe/Warsaw")!  // UTC+2 in August
        let now = date("2026-08-24T03:00:00Z")               // 05:00 local
        let queue = [message("a", created: date("2026-08-24T03:00:00Z"))]

        let plan = EncouragementPlanner.plan(now: now, queue: queue, slots: EncouragementSlot.all, timezone: warsaw)

        // 09:00 Warsaw is 07:00 UTC.
        XCTAssertEqual(plan[0].fireDate, date("2026-08-24T07:00:00Z"))
    }

    func testExpiredReturnsUndeliveredMessagesOlderThanThreeDays() {
        let now = date("2026-08-24T05:00:00Z")
        let queue = [
            message("old", created: date("2026-08-20T05:00:00Z")),
            message("edge", created: date("2026-08-21T04:00:00Z")),
            message("fresh", created: date("2026-08-23T05:00:00Z")),
        ]

        let expired = EncouragementPlanner.expired(queue, now: now)

        XCTAssertEqual(expired.map(\.id).sorted(), ["edge", "old"])
    }

    func testExpiredIgnoresDeliveredMessagesHoweverOld() {
        let now = date("2026-08-24T05:00:00Z")
        var delivered = message("ancient", created: date("2026-08-01T05:00:00Z"))
        delivered.deliveredAt = date("2026-08-01T09:00:00Z")

        XCTAssertTrue(EncouragementPlanner.expired([delivered], now: now).isEmpty)
    }

    func testExpiredReturnsNothingForAFreshQueue() {
        let now = date("2026-08-24T05:00:00Z")
        let queue = [message("fresh", created: date("2026-08-24T04:00:00Z"))]

        XCTAssertTrue(EncouragementPlanner.expired(queue, now: now).isEmpty)
    }
}
