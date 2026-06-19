import XCTest
@testable import LuminaLog

/// Streak rules from spec §3: increment when the previous entry was
/// yesterday (in the user's timezone), keep when it was today, reset to 1
/// after a gap.
final class StreakCalculatorTests: XCTestCase {

    private let timezone = TimeZone(identifier: "America/Los_Angeles")!

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone
        return calendar
    }

    /// A date at the given local time in the test timezone.
    private func date(_ year: Int, _ month: Int, _ day: Int, hour: Int = 12) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour))!
    }

    func testEntryYesterdayIncrementsStreak() {
        let current = UserProfile.Stats(
            streakCount: 5,
            lastEntryDate: date(2026, 6, 9, hour: 22),
            totalWords: 1_000
        )
        let next = StreakCalculator.nextStats(
            current: current,
            entryDate: date(2026, 6, 10, hour: 7),
            timezone: timezone
        )
        XCTAssertEqual(next.streakCount, 6)
        XCTAssertEqual(next.lastEntryDate, date(2026, 6, 10, hour: 7))
        XCTAssertEqual(next.totalWords, 1_000, "nextStats must not touch totalWords")
    }

    func testSecondEntryTodayKeepsStreak() {
        let current = UserProfile.Stats(
            streakCount: 5,
            lastEntryDate: date(2026, 6, 10, hour: 6),
            totalWords: 1_000
        )
        let next = StreakCalculator.nextStats(
            current: current,
            entryDate: date(2026, 6, 10, hour: 21),
            timezone: timezone
        )
        XCTAssertEqual(next.streakCount, 5)
        XCTAssertEqual(next.lastEntryDate, date(2026, 6, 10, hour: 21))
    }

    func testGapResetsStreakToOne() {
        let current = UserProfile.Stats(
            streakCount: 12,
            lastEntryDate: date(2026, 6, 6),
            totalWords: 1_000
        )
        let next = StreakCalculator.nextStats(
            current: current,
            entryDate: date(2026, 6, 10),
            timezone: timezone
        )
        XCTAssertEqual(next.streakCount, 1)
    }

    func testFirstEverEntryStartsStreakAtOne() {
        let current = UserProfile.Stats(streakCount: 0, lastEntryDate: nil, totalWords: 0)
        let next = StreakCalculator.nextStats(
            current: current,
            entryDate: date(2026, 6, 10),
            timezone: timezone
        )
        XCTAssertEqual(next.streakCount, 1)
    }

    func testTimezoneBoundaryCountsAsYesterday() {
        // 11 PM June 9 in LA is already June 10 in UTC — the streak decision
        // must follow the user's timezone, not UTC.
        let current = UserProfile.Stats(
            streakCount: 3,
            lastEntryDate: date(2026, 6, 9, hour: 23),
            totalWords: 0
        )
        let next = StreakCalculator.nextStats(
            current: current,
            entryDate: date(2026, 6, 10, hour: 1),
            timezone: timezone
        )
        XCTAssertEqual(next.streakCount, 4)
    }

    @MainActor
    func testMockProfileRepositoryRecordEntrySavedAppliesStreakAndWords() async throws {
        var profile = MockData.profile
        profile.timezone = timezone.identifier
        profile.stats = UserProfile.Stats(
            streakCount: 2,
            lastEntryDate: date(2026, 6, 9),
            totalWords: 100
        )
        let repository = MockProfileRepository(profile: profile)

        // A qualifying day (≥ DailyGoal.wordTarget) after a qualifying yesterday
        // bumps the streak and adds the words.
        try await repository.recordEntrySaved(wordCountDelta: 800, on: date(2026, 6, 10))

        var iterator = repository.profile().makeAsyncIterator()
        let updated = await iterator.next()
        XCTAssertEqual(updated??.stats.streakCount, 3)
        XCTAssertEqual(updated??.stats.totalWords, 900)
        XCTAssertEqual(updated??.stats.goalDayWords, 800)
    }

    @MainActor
    func testMockProfileRepositorySubGoalEntryDoesNotBumpStreak() async throws {
        var profile = MockData.profile
        profile.timezone = timezone.identifier
        profile.stats = UserProfile.Stats(
            streakCount: 2,
            lastEntryDate: date(2026, 6, 9),
            totalWords: 100
        )
        let repository = MockProfileRepository(profile: profile)

        // Below the daily goal: words accumulate but the streak is untouched.
        try await repository.recordEntrySaved(wordCountDelta: 50, on: date(2026, 6, 10))

        var iterator = repository.profile().makeAsyncIterator()
        let updated = await iterator.next()
        XCTAssertEqual(updated??.stats.streakCount, 2)
        XCTAssertEqual(updated??.stats.totalWords, 150)
        XCTAssertEqual(updated??.stats.goalDayWords, 50)
    }
}
