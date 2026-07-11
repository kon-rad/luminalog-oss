import XCTest
@testable import LuminaLog

/// Goal-gated streak: a day only counts once its entries total
/// `DailyGoal.wordTarget`. Driven by an authoritative recompute of the day's
/// total (`reconciled`) rather than deltas — reconciling to the same or a lower
/// total never double-advances or regresses the streak.
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

    private func reconcile(
        _ current: UserProfile.Stats,
        todayTotal: Int,
        now: Date
    ) -> UserProfile.Stats {
        DailyGoalStreak.reconciled(
            current: current,
            todayTotal: todayTotal,
            now: now,
            timezone: tz,
            target: target
        )
    }

    func testBelowTargetSetsWordsButDoesNotAdvanceStreak() {
        let start = UserProfile.Stats(streakCount: 3, lastEntryDate: date(2026, 6, 9), totalWords: 100)
        let result = reconcile(start, todayTotal: 300, now: date(2026, 6, 10))
        XCTAssertEqual(result.goalDayWords, 300)
        XCTAssertEqual(result.totalWords, 100, "reconcile never touches the lifetime odometer")
        XCTAssertEqual(result.streakCount, 3, "below target must not change the streak")
        XCTAssertEqual(result.lastEntryDate, date(2026, 6, 9), "below target must not re-anchor the qualifying day")
    }

    func testCrossingTargetAdvancesOnceThenReconcilesAreIdempotent() {
        // Yesterday was a qualifying day, so crossing today should be +1.
        let start = UserProfile.Stats(streakCount: 3, lastEntryDate: date(2026, 6, 9), totalWords: 100)
        let afterFirst = reconcile(start, todayTotal: 400, now: date(2026, 6, 10, hour: 9))
        XCTAssertEqual(afterFirst.streakCount, 3, "still below 750 after 400")
        let afterSecond = reconcile(afterFirst, todayTotal: 800, now: date(2026, 6, 10, hour: 21))
        XCTAssertEqual(afterSecond.goalDayWords, 800)
        XCTAssertEqual(afterSecond.streakCount, 4, "crossing 750 advances the streak once")
        XCTAssertEqual(afterSecond.lastEntryDate, date(2026, 6, 10, hour: 21))
        // A further reconcile to a higher total the same already-credited day must
        // not advance again.
        let afterThird = reconcile(afterSecond, todayTotal: 900, now: date(2026, 6, 10, hour: 22))
        XCTAssertEqual(afterThird.goalDayWords, 900)
        XCTAssertEqual(afterThird.streakCount, 4, "same already-credited day must not double count")
    }

    func testReconcileToLowerTotalAfterCreditDoesNotRegressStreak() {
        // Crossed and credited earlier today...
        let start = UserProfile.Stats(
            streakCount: 4,
            lastEntryDate: date(2026, 6, 10, hour: 9),
            totalWords: 800,
            goalDayDate: date(2026, 6, 10, hour: 9),
            goalDayWords: 800
        )
        // ...then a delete drops today's total below the goal.
        let result = reconcile(start, todayTotal: 300, now: date(2026, 6, 10, hour: 15))
        XCTAssertEqual(result.goalDayWords, 300, "words reflect the recompute")
        XCTAssertEqual(result.streakCount, 4, "a credited day never loses its credit")
        XCTAssertEqual(result.lastEntryDate, date(2026, 6, 10, hour: 9))
    }

    func testQualifyingDayAfterGapResetsToOne() {
        // Last qualifying day was 4 days ago.
        let start = UserProfile.Stats(streakCount: 9, lastEntryDate: date(2026, 6, 6), totalWords: 5_000)
        let result = reconcile(start, todayTotal: 800, now: date(2026, 6, 10))
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
        let result = reconcile(start, todayTotal: 200, now: date(2026, 6, 10))
        XCTAssertEqual(result.goalDayWords, 200, "new day reflects only its own entries")
        XCTAssertEqual(result.goalDayDate, date(2026, 6, 10))
        XCTAssertEqual(result.streakCount, 4, "200 < 750 so streak unchanged this new day")
    }

    func testFirstEverQualifyingDayStartsStreakAtOne() {
        let start = UserProfile.Stats() // all defaults: no lastEntryDate
        let result = reconcile(start, todayTotal: 750, now: date(2026, 6, 10))
        XCTAssertEqual(result.streakCount, 1)
        XCTAssertEqual(result.lastEntryDate, date(2026, 6, 10))
        XCTAssertEqual(result.goalDayWords, 750)
    }

    func testMaxStreakCountRisesWithNewPeak() {
        let start = UserProfile.Stats(
            streakCount: 3,
            maxStreakCount: 3,
            lastEntryDate: date(2026, 6, 9),
            totalWords: 3000,
            goalDayDate: date(2026, 6, 9),
            goalDayWords: 900
        )
        let result = reconcile(start, todayTotal: 800, now: date(2026, 6, 10))
        XCTAssertEqual(result.streakCount, 4)
        XCTAssertEqual(result.maxStreakCount, 4)
    }

    func testMaxStreakCountHoldsWhenCurrentStreakResets() {
        // Best streak of 5, last credited on the 9th; jumping to the 11th is a
        // 2-day gap → current streak resets to 1, max stays 5.
        let start = UserProfile.Stats(
            streakCount: 5,
            maxStreakCount: 5,
            lastEntryDate: date(2026, 6, 9),
            totalWords: 5000,
            goalDayDate: date(2026, 6, 9),
            goalDayWords: 900
        )
        let result = reconcile(start, todayTotal: 800, now: date(2026, 6, 11))
        XCTAssertEqual(result.streakCount, 1)
        XCTAssertEqual(result.maxStreakCount, 5)
    }
}
