import XCTest
@testable import LuminaLog

final class DayBucketingTests: XCTestCase {
    private func d(_ iso: String) -> Date {
        let f = ISO8601DateFormatter(); return f.date(from: iso)!
    }

    func testDayIndexIsUtcDaysSinceEpoch() {
        XCTAssertEqual(DayBucketing.dayIndex(for: d("2024-10-04T00:00:00Z")), 20000)
        XCTAssertEqual(DayBucketing.dayIndex(for: d("2024-10-04T23:59:59Z")), 20000)
        XCTAssertEqual(DayBucketing.dayIndex(for: d("2024-10-05T00:00:00Z")), 20001)
    }

    func testDateStringForDayIndexMatchesServer() {
        XCTAssertEqual(DayBucketing.dateString(forDayIndex: 20000), "2024-10-04")
    }

    func testBucketGroupsByUtcDayAndSumsWords() {
        let buckets = DayBucketing.bucket(entries: [
            (text: "a", wordCount: 300, createdAt: d("2024-10-04T08:00:00Z")),
            (text: "b", wordCount: 500, createdAt: d("2024-10-04T20:00:00Z")),
            (text: "c", wordCount: 100, createdAt: d("2024-10-05T09:00:00Z")),
        ])
        XCTAssertEqual(buckets.count, 2)
        let day0 = buckets.first { $0.dayIndex == 20000 }!
        XCTAssertEqual(day0.wordTotal, 800)
        XCTAssertEqual(day0.texts.count, 2)
        XCTAssertEqual(day0.date, "2024-10-04")
    }

    func testStreakRunLengths() {
        // days 10,11,12 consecutive, then 20 alone
        let s = DayBucketing.streaks(sortedQualifyingDayIndices: [10, 11, 12, 20])
        XCTAssertEqual(s[10], 1)
        XCTAssertEqual(s[11], 2)
        XCTAssertEqual(s[12], 3)
        XCTAssertEqual(s[20], 1)
    }
}
