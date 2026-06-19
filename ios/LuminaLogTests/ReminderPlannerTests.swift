import XCTest
@testable import LuminaLog

/// Smart reminder scheduling: fire today if the goal isn't met and the time is
/// still ahead; otherwise tomorrow. Never fire on a day already satisfied.
final class ReminderPlannerTests: XCTestCase {

    private let tz = TimeZone(identifier: "America/Los_Angeles")!

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = tz
        return c
    }

    private func date(_ y: Int, _ m: Int, _ d: Int, _ hour: Int, _ minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: hour, minute: minute))!
    }

    func testNotMetAndTimeAheadSchedulesToday() {
        let fire = ReminderPlanner.nextFireDate(
            now: date(2026, 6, 10, 9),
            reminderHour: 20, reminderMinute: 0,
            goalMetToday: false, timezone: tz
        )
        XCTAssertEqual(fire, date(2026, 6, 10, 20, 0))
    }

    func testNotMetButTimePassedSchedulesTomorrow() {
        let fire = ReminderPlanner.nextFireDate(
            now: date(2026, 6, 10, 21),
            reminderHour: 20, reminderMinute: 0,
            goalMetToday: false, timezone: tz
        )
        XCTAssertEqual(fire, date(2026, 6, 11, 20, 0))
    }

    func testGoalMetSchedulesTomorrowEvenIfTimeAhead() {
        let fire = ReminderPlanner.nextFireDate(
            now: date(2026, 6, 10, 9),
            reminderHour: 20, reminderMinute: 0,
            goalMetToday: true, timezone: tz
        )
        XCTAssertEqual(fire, date(2026, 6, 11, 20, 0))
    }

    func testExactlyAtReminderMinuteSchedulesTomorrow() {
        // now == today's reminder time: not strictly in the future → tomorrow.
        let fire = ReminderPlanner.nextFireDate(
            now: date(2026, 6, 10, 20, 0),
            reminderHour: 20, reminderMinute: 0,
            goalMetToday: false, timezone: tz
        )
        XCTAssertEqual(fire, date(2026, 6, 11, 20, 0))
    }
}
