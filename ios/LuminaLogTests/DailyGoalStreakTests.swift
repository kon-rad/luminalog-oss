import XCTest
@testable import LuminaLog

/// Goal-gated streak: a day only counts once its entries total
/// `DailyGoal.wordTarget`. Words accumulate across the day; the streak
/// advances on the crossing, reusing StreakCalculator's day-adjacency math.
final class DailyGoalStreakTests: XCTestCase {

    private let tz = TimeZone(identifier: "America/Los_Angeles")!
    private let target = 750

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = tz
        return c
    }

    private func date(_ y: Int, _ m: Int, _ d: Int, hour: Int = 12) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: hour))!
    }

    private func next(
        _ current: UserProfile.Stats,
        delta: Int,
        on date: Date
    ) -> UserProfile.Stats {
        DailyGoalStreak.nextStats(
            current: current,
            wordCountDelta: delta,
            entryDate: date,
            timezone: tz,
            target: target
        )
    }

    func testBelowTargetAccumulatesButDoesNotAdvanceStreak() {
        let start = UserProfile.Stats(streakCount: 3, lastEntryDate: date(2026, 6, 9), totalWords: 100)
        let result = next(start, delta: 300, on: date(2026, 6, 10))
        XCTAssertEqual(result.goalDayWords, 300)
        XCTAssertEqual(result.totalWords, 400)
        XCTAssertEqual(result.streakCount, 3, "below target must not change the streak")
        XCTAssertEqual(result.lastEntryDate, date(2026, 6, 9), "below target must not re-anchor the qualifying day")
    }

    func testTwoEntriesSameDayCrossTargetAdvancesOnce() {
        // Yesterday was a qualifying day, so crossing today should be +1.
        let start = UserProfile.Stats(streakCount: 3, lastEntryDate: date(2026, 6, 9), totalWords: 100)
        let afterFirst = next(start, delta: 400, on: date(2026, 6, 10, hour: 9))
        XCTAssertEqual(afterFirst.streakCount, 3, "still below 750 after 400")
        let afterSecond = next(afterFirst, delta: 400, on: date(2026, 6, 10, hour: 21))
        XCTAssertEqual(afterSecond.goalDayWords, 800)
        XCTAssertEqual(afterSecond.streakCount, 4, "crossing 750 advances the streak once")
        XCTAssertEqual(afterSecond.lastEntryDate, date(2026, 6, 10, hour: 21))
        // A third entry the same already-credited day must not advance again.
        let afterThird = next(afterSecond, delta: 100, on: date(2026, 6, 10, hour: 22))
        XCTAssertEqual(afterThird.goalDayWords, 900)
        XCTAssertEqual(afterThird.streakCount, 4, "same already-credited day must not double count")
    }

    func testQualifyingDayAfterGapResetsToOne() {
        // Last qualifying day was 4 days ago.
        let start = UserProfile.Stats(streakCount: 9, lastEntryDate: date(2026, 6, 6), totalWords: 5_000)
        let result = next(start, delta: 800, on: date(2026, 6, 10))
        XCTAssertEqual(result.streakCount, 1, "a gap resets the streak to 1 on the next qualifying day")
        XCTAssertEqual(result.lastEntryDate, date(2026, 6, 10))
        XCTAssertEqual(result.goalDayWords, 800)
    }

    func testNewDayResetsGoalDayWords() {
        // Yesterday qualified (goalDayWords 900); a new day starts fresh.
        let start = UserProfile.Stats(
            streakCount: 4,
            lastEntryDate: date(2026, 6, 9),
            totalWords: 900,
            goalDayDate: date(2026, 6, 9),
            goalDayWords: 900
        )
        let result = next(start, delta: 200, on: date(2026, 6, 10))
        XCTAssertEqual(result.goalDayWords, 200, "new day starts its own accumulation")
        XCTAssertEqual(result.goalDayDate, date(2026, 6, 10))
        XCTAssertEqual(result.streakCount, 4, "200 < 750 so streak unchanged this new day")
    }

    func testFirstEverQualifyingEntryStartsStreakAtOne() {
        let start = UserProfile.Stats() // all defaults: no lastEntryDate
        let result = next(start, delta: 750, on: date(2026, 6, 10))
        XCTAssertEqual(result.streakCount, 1)
        XCTAssertEqual(result.lastEntryDate, date(2026, 6, 10))
        XCTAssertEqual(result.goalDayWords, 750)
    }
}
