import XCTest
@testable import LuminaLog

/// `UserProfile.Stats` ↔ Firestore mapping, including the goal-tracking
/// fields and legacy documents that predate them.
final class StatsMappingTests: XCTestCase {

    func testStatsRoundTripsGoalFields() {
        let day = Date(timeIntervalSince1970: 1_700_000_000)
        let original = UserProfile.Stats(
            streakCount: 4,
            lastEntryDate: day,
            totalWords: 3_210,
            goalDayDate: day,
            goalDayWords: 420
        )
        let restored = UserProfile.Stats(data: original.firestoreData)
        XCTAssertEqual(restored.streakCount, 4)
        XCTAssertEqual(restored.totalWords, 3_210)
        XCTAssertEqual(restored.goalDayWords, 420)
        XCTAssertNotNil(restored.goalDayDate)
        XCTAssertEqual(
            restored.goalDayDate!.timeIntervalSince1970,
            day.timeIntervalSince1970,
            accuracy: 1
        )
    }

    func testLegacyStatsDecodeWithDefaults() {
        // A document written before the goal fields existed.
        let legacy: [String: Any] = ["streakCount": 7, "totalWords": 9_000]
        let stats = UserProfile.Stats(data: legacy)
        XCTAssertEqual(stats.streakCount, 7)
        XCTAssertEqual(stats.totalWords, 9_000)
        XCTAssertEqual(stats.goalDayWords, 0)
        XCTAssertNil(stats.goalDayDate)
    }
}
