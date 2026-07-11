import XCTest
@testable import LuminaLog

/// `TodayWords.total` is the single source of truth for "words journaled today":
/// a pure recompute over entries whose `createdAt` is the current calendar day in
/// the user's timezone. These tests pin the day boundary and the summing.
final class TodayWordsTests: XCTestCase {

    private let tz = TimeZone(identifier: "America/Los_Angeles")!

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = tz
        return c
    }

    private func at(_ y: Int, _ m: Int, _ d: Int, _ h: Int, _ min: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
    }

    private func entry(_ id: String, words: Int, createdAt: Date) -> JournalEntry {
        JournalEntry(
            id: id, userId: "u", type: .text, title: "t",
            createdAt: createdAt,
            content: Array(repeating: "word", count: words).joined(separator: " "),
            media: [], transcriptStatus: nil, processingStatus: nil, wordCount: words)
    }

    func testSumsOnlyEntriesFromTheCurrentDay() {
        let now = at(2026, 6, 10, 12)
        let entries = [
            entry("a", words: 100, createdAt: at(2026, 6, 10, 9)),
            entry("b", words: 200, createdAt: at(2026, 6, 10, 21)),
            entry("c", words: 999, createdAt: at(2026, 6, 9, 23)), // yesterday
        ]
        XCTAssertEqual(TodayWords.total(from: entries, timezone: tz, now: now), 300)
    }

    func testTimezoneMidnightBoundary() {
        let now = at(2026, 6, 10, 12)
        // 23:59 the day before and 00:01 today, in the user's timezone.
        let lastNight = at(2026, 6, 9, 23, 59)
        let earlyToday = at(2026, 6, 10, 0, 1)
        let entries = [
            entry("late", words: 500, createdAt: lastNight),
            entry("early", words: 40, createdAt: earlyToday),
        ]
        XCTAssertEqual(
            TodayWords.total(from: entries, timezone: tz, now: now), 40,
            "23:59 yesterday is excluded; 00:01 today is included")
    }

    func testEmptyListIsZero() {
        XCTAssertEqual(TodayWords.total(from: [], timezone: tz, now: at(2026, 6, 10, 12)), 0)
    }

    /// The list may have been fetched yesterday, but `now` is what defines "today"
    /// — so a list of only-yesterday entries totals 0 once the clock rolls over.
    func testCrossesMidnightUsingNowNotFetchTime() {
        let entries = [entry("y", words: 800, createdAt: at(2026, 6, 9, 22))]
        XCTAssertEqual(
            TodayWords.total(from: entries, timezone: tz, now: at(2026, 6, 10, 0, 5)), 0)
    }
}
