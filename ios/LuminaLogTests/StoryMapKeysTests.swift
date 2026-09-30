import XCTest
@testable import LuminaLog

final class StoryMapKeysTests: XCTestCase {

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return Int(floor(cal.date(from: DateComponents(year: y, month: m, day: d))!.timeIntervalSince1970 / 86_400))
    }

    private var everyTier: [PeriodKey] {
        [PeriodKey(.day, day(2026, 9, 26)), PeriodKey(.week, 202640), PeriodKey(.month, 2026 * 12 + 8),
         PeriodKey(.quarter, 2026 * 4 + 2), PeriodKey(.year, 2026), PeriodKey(.all, 0)]
    }

    func testLifetimeMapsToAll() {
        XCTAssertEqual(StoryMapKeys.summaryKey(periodType: "lifetime", periodIndex: 0)?.docId, "all_0")
    }

    func testOtherTiersPassThrough() {
        let pairs: [(String, PeriodSummaryType)] = [("day", .day), ("week", .week), ("month", .month),
                                                     ("quarter", .quarter), ("year", .year)]
        for (name, type) in pairs {
            XCTAssertEqual(StoryMapKeys.summaryKey(periodType: name, periodIndex: 42), PeriodKey(type, 42), name)
        }
    }

    func testUnknownTierIsNil() {
        XCTAssertNil(StoryMapKeys.summaryKey(periodType: "decade", periodIndex: 1))
        XCTAssertNil(StoryMapKeys.summaryKey(periodType: "all", periodIndex: 0))   // the store's name, not the pyramid's
    }

    func testPyramidTargets() {
        XCTAssertEqual(StoryMapKeys.pyramidTarget(for: PeriodKey(.all, 0)),
                       PyramidTarget(periodType: "lifetime", periodIndex: 0))
        XCTAssertEqual(StoryMapKeys.pyramidTarget(for: PeriodKey(.week, 202640)),
                       PyramidTarget(periodType: "week", periodIndex: 202640))
    }

    func testRoundTripsEveryTier() {
        for key in everyTier {
            let target = StoryMapKeys.pyramidTarget(for: key)
            XCTAssertEqual(StoryMapKeys.summaryKey(periodType: target.periodType, periodIndex: target.periodIndex), key)
        }
    }

    func testSampleDayLandsInsideThePeriod() {
        XCTAssertEqual(StoryMapKeys.sampleDay(for: PeriodKey(.week, 202640)), day(2026, 9, 28))
        XCTAssertEqual(StoryMapKeys.sampleDay(for: PeriodKey(.week, 202601)), day(2025, 12, 29))   // ISO week 1 starts in December
        XCTAssertEqual(StoryMapKeys.sampleDay(for: PeriodKey(.month, 2026 * 12 + 8)), day(2026, 9, 1))
        XCTAssertEqual(StoryMapKeys.sampleDay(for: PeriodKey(.quarter, 2026 * 4 + 3)), day(2026, 10, 1))
        XCTAssertEqual(StoryMapKeys.sampleDay(for: PeriodKey(.year, 2025)), day(2025, 1, 1))
        for key in everyTier {
            XCTAssertEqual(PeriodSummaryIndex.key(key.type, forDay: StoryMapKeys.sampleDay(for: key)), key, key.docId)
        }
    }

    func testLabelsAreTheCalendarLabels() {
        let week = PeriodKey(.week, 202640)
        let month = PeriodKey(.month, 2026 * 12 + 8)
        XCTAssertEqual(PeriodSummaryIndex.label(for: week, sampleDay: StoryMapKeys.sampleDay(for: week)),
                       "Week of Mon 28 Sep 2026")
        XCTAssertEqual(PeriodSummaryIndex.label(for: month, sampleDay: StoryMapKeys.sampleDay(for: month)),
                       "September 2026")
    }
}
