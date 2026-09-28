import XCTest
@testable import LuminaLog

final class PeriodSummaryIndexTests: XCTestCase {

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let date = cal.date(from: DateComponents(year: y, month: m, day: d))!
        return Int(floor(date.timeIntervalSince1970 / 86_400))
    }

    private func instant(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    func testEarlyMorningInUTCPlus8IsTheLocalDayNotUTCs() {
        let kl = TimeZone(identifier: "Asia/Kuala_Lumpur")!
        // 07:59 local on 26 Sep is 23:59 UTC on 25 Sep.
        XCTAssertEqual(PeriodSummaryIndex.localDayIndex(for: instant("2026-09-25T23:59:00Z"), in: kl), day(2026, 9, 26))
    }

    func testLateEveningWestOfUTCIsTheLocalDay() {
        let la = TimeZone(identifier: "America/Los_Angeles")!
        // 23:30 PDT on 26 Sep is 06:30 UTC on 27 Sep.
        XCTAssertEqual(PeriodSummaryIndex.localDayIndex(for: instant("2026-09-27T06:30:00Z"), in: la), day(2026, 9, 26))
    }

    func testDaylightSavingStartDayIsStillOneDay() {
        let la = TimeZone(identifier: "America/Los_Angeles")!
        // US DST starts Sun 8 Mar 2026. 00:30 PST and 23:30 PDT are both that day.
        XCTAssertEqual(PeriodSummaryIndex.localDayIndex(for: instant("2026-03-08T08:30:00Z"), in: la), day(2026, 3, 8))
        XCTAssertEqual(PeriodSummaryIndex.localDayIndex(for: instant("2026-03-09T06:30:00Z"), in: la), day(2026, 3, 8))
    }

    func testWeekStraddlingAMonthSharesTheWeekButNotTheMonth() {
        let wed = day(2026, 9, 30), thu = day(2026, 10, 1)
        XCTAssertEqual(PeriodSummaryIndex.key(.week, forDay: wed), PeriodSummaryIndex.key(.week, forDay: thu))
        XCTAssertNotEqual(PeriodSummaryIndex.key(.month, forDay: wed), PeriodSummaryIndex.key(.month, forDay: thu))
    }

    func testISOWeek53SpansTheYearBoundary() {
        XCTAssertEqual(PeriodSummaryIndex.key(.week, forDay: day(2026, 12, 31)), PeriodKey(.week, 202653))
        XCTAssertEqual(PeriodSummaryIndex.key(.week, forDay: day(2027, 1, 1)), PeriodKey(.week, 202653))
    }

    func testKeysForEveryTier() {
        let sat = day(2026, 9, 26)
        XCTAssertEqual(PeriodSummaryIndex.key(.day, forDay: sat), PeriodKey(.day, sat))
        XCTAssertEqual(PeriodSummaryIndex.key(.week, forDay: sat), PeriodKey(.week, 202639))
        XCTAssertEqual(PeriodSummaryIndex.key(.month, forDay: sat), PeriodKey(.month, 2026 * 12 + 8))
        XCTAssertEqual(PeriodSummaryIndex.key(.quarter, forDay: sat), PeriodKey(.quarter, 2026 * 4 + 2))
        XCTAssertEqual(PeriodSummaryIndex.key(.year, forDay: sat), PeriodKey(.year, 2026))
        XCTAssertEqual(PeriodSummaryIndex.key(.all, forDay: sat), PeriodKey(.all, 0))
    }

    func testLabels() {
        let sat = day(2026, 9, 26)
        func label(_ t: PeriodSummaryType) -> String {
            PeriodSummaryIndex.label(for: PeriodSummaryIndex.key(t, forDay: sat), sampleDay: sat)
        }
        XCTAssertEqual(label(.day), "Sat 26 Sep 2026")
        XCTAssertEqual(label(.week), "Week of Mon 21 Sep 2026")
        XCTAssertEqual(label(.month), "September 2026")
        XCTAssertEqual(label(.quarter), "Q3 2026")
        XCTAssertEqual(label(.year), "2026")
        XCTAssertEqual(label(.all), "All time")
    }

    func testWeekLabelOnASundayFindsThatWeeksMonday() {
        let sun = day(2026, 9, 27)
        XCTAssertEqual(PeriodSummaryIndex.label(for: PeriodSummaryIndex.key(.week, forDay: sun), sampleDay: sun),
                       "Week of Mon 21 Sep 2026")
    }

    func testIsOpen() {
        let today = day(2026, 9, 26)
        XCTAssertTrue(PeriodSummaryIndex.isOpen(PeriodSummaryIndex.key(.week, forDay: today), today: today))
        XCTAssertFalse(PeriodSummaryIndex.isOpen(PeriodSummaryIndex.key(.week, forDay: today - 7), today: today))
        XCTAssertFalse(PeriodSummaryIndex.isOpen(PeriodKey(.day, today - 1), today: today))
        XCTAssertTrue(PeriodSummaryIndex.isOpen(PeriodKey(.all, 0), today: today))
    }

    func testDayOfMonth() {
        XCTAssertEqual(PeriodSummaryIndex.dayOfMonth(day(2026, 9, 26)), 26)
    }

    func testDocIdRoundTrip() {
        XCTAssertEqual(PeriodKey(.week, 202639).docId, "week_202639")
        XCTAssertEqual(PeriodKey(docId: "week_202639"), PeriodKey(.week, 202639))
        XCTAssertEqual(PeriodKey(docId: "all_0"), PeriodKey(.all, 0))
        XCTAssertNil(PeriodKey(docId: "decade_1"))
        XCTAssertNil(PeriodKey(docId: "week_x"))
        XCTAssertNil(PeriodKey(docId: "week"))
    }

    func testChildTypes() {
        XCTAssertNil(PeriodSummaryType.day.childType)
        XCTAssertEqual(PeriodSummaryType.week.childType, .day)
        XCTAssertEqual(PeriodSummaryType.month.childType, .day)
        XCTAssertEqual(PeriodSummaryType.quarter.childType, .month)
        XCTAssertEqual(PeriodSummaryType.year.childType, .quarter)
        XCTAssertEqual(PeriodSummaryType.all.childType, .year)
    }
}
