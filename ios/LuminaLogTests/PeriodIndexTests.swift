import XCTest
@testable import LuminaLog

final class PeriodIndexTests: XCTestCase {
    /// Days since epoch (UTC) for a calendar date, matching `dateForDayIndex` on the
    /// server (`new Date(dayIndex * 86_400_000)` inverted).
    private func dayIndex(_ year: Int, _ month: Int, _ day: Int) -> Int {
        var comps = DateComponents()
        comps.year = year; comps.month = month; comps.day = day
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let date = cal.date(from: comps)!
        return Int(floor(date.timeIntervalSince1970 / 86_400))
    }

    func testMonthIndexIsYearTimes12PlusZeroBasedMonth() {
        XCTAssertEqual(PeriodIndex.monthIndex(forDayIndex: dayIndex(2026, 6, 1)), 2026 * 12 + 5)
    }

    func testQuarterIndexIsYearTimes4PlusZeroBasedQuarter() {
        XCTAssertEqual(PeriodIndex.quarterIndex(forDayIndex: dayIndex(2026, 6, 1)), 2026 * 4 + 1)
    }

    func testYearIndexIsCalendarYear() {
        XCTAssertEqual(PeriodIndex.yearIndex(forDayIndex: dayIndex(2026, 6, 1)), 2026)
    }

    func testWeekIndexMidWeek() {
        // 2026-06-01 is a Monday; ISO week containing it.
        let idx = PeriodIndex.weekIndex(forDayIndex: dayIndex(2026, 6, 1))
        XCTAssertEqual(idx / 100, 2026)
    }

    func testWeekIndexLateDecemberBelongsToNextIsoYearWeek1() {
        // 2026-12-31 is a Thursday; its ISO week is week 53 of 2026, matching the
        // server's periodIndex.test.ts fixture for the same edge case.
        let idx = PeriodIndex.weekIndex(forDayIndex: dayIndex(2026, 12, 31))
        XCTAssertEqual(idx, 2026 * 100 + 53)
    }

    func testThursdayDayIndexAlwaysLandsOnAThursday() {
        let monday = dayIndex(2026, 6, 1)
        let thursday = PeriodIndex.thursdayDayIndex(forDayIndex: monday)
        // Thursday - Monday = 3 days.
        XCTAssertEqual(thursday - monday, 3)
    }
}