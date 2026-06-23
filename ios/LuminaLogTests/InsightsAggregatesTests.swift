import XCTest
@testable import LuminaLog

final class InsightsAggregatesTests: XCTestCase {

    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func date(_ y: Int, _ m: Int, _ d: Int) -> Date {
        cal.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    private func entry(type: JournalType, on date: Date, words: Int = 0,
                       emotion: String? = nil) -> JournalEntry {
        let e = emotion.map {
            EmotionScore(source: "text", scores: [$0: 0.9],
                         top: [EmotionScore.Pick(name: $0, score: 0.9)])
        }
        return JournalEntry(userId: "u", type: type, title: "",
                            createdAt: date, content: "", wordCount: words, emotion: e)
    }

    func testTypeBreakdownCountsAndSortsDescending() {
        let entries = [
            entry(type: .text, on: date(2026, 6, 1)),
            entry(type: .text, on: date(2026, 6, 2)),
            entry(type: .voice, on: date(2026, 6, 3)),
        ]
        let slices = InsightsAggregates.typeBreakdown(from: entries)
        XCTAssertEqual(slices.map(\.type), [.text, .voice])
        XCTAssertEqual(slices.map(\.count), [2, 1])
    }

    func testEmotionTrendBucketsByDayAndDominantEmotion() {
        let entries = [
            entry(type: .text, on: date(2026, 6, 1), emotion: "joy"),
            entry(type: .text, on: date(2026, 6, 1), emotion: "joy"),
            entry(type: .text, on: date(2026, 6, 2), emotion: "sadness"),
            entry(type: .text, on: date(2026, 6, 2), emotion: nil), // skipped
        ]
        let points = InsightsAggregates.emotionTrend(from: entries, calendar: cal)
        XCTAssertEqual(points.count, 2)
        let joy = points.first { $0.emotion == "joy" }
        XCTAssertEqual(joy?.count, 2)
        XCTAssertEqual(joy?.date, cal.startOfDay(for: date(2026, 6, 1)))
        XCTAssertEqual(points.first { $0.emotion == "sadness" }?.count, 1)
    }

    func testActivityProducesDenseDailyWindow() {
        let start = date(2026, 6, 1)
        let end = date(2026, 6, 3)
        let window = DateInterval(start: cal.startOfDay(for: start),
                                  end: cal.startOfDay(for: end))
        let entries = [
            entry(type: .text, on: date(2026, 6, 1), words: 10),
            entry(type: .text, on: date(2026, 6, 1), words: 5),
            entry(type: .text, on: date(2026, 6, 3), words: 7),
        ]
        let days = InsightsAggregates.activity(from: entries, window: window, calendar: cal)
        XCTAssertEqual(days.count, 3) // Jun 1, 2, 3 inclusive — dense
        XCTAssertEqual(days[0].entryCount, 2)
        XCTAssertEqual(days[0].wordCount, 15)
        XCTAssertEqual(days[1].entryCount, 0) // gap day still present
        XCTAssertEqual(days[2].wordCount, 7)
    }
}
