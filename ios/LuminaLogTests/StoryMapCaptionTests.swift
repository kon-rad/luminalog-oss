import XCTest
@testable import LuminaLog

final class StoryMapCaptionTests: XCTestCase {

    private let utc = TimeZone(identifier: "UTC")!
    private let kl = TimeZone(identifier: "Asia/Kuala_Lumpur")!

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = utc
        return Int(floor(cal.date(from: DateComponents(year: y, month: m, day: d))!.timeIntervalSince1970 / 86_400))
    }

    private func at(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    private func entry(_ id: String, _ iso: String, title: String) -> JournalEntry {
        JournalEntry(id: id, userId: "u", type: .text, title: title, createdAt: at(iso), updatedAt: at(iso),
                     content: "Body", summary: AIGeneration(text: "Entry \(id)", generatedAt: at(iso)))
    }

    private let week39 = PeriodKey(.week, 202639)          // Mon 21 Sep 2026
    private let september = PeriodKey(.month, 2026 * 12 + 8)

    private var entries: [String: JournalEntry] {
        ["e3": entry("e3", "2026-09-22T08:00:00Z", title: "Signed the lease"),
         "e5": entry("e5", "2026-09-24T20:00:00Z", title: "Evening walk")]
    }

    private func summary(_ key: PeriodKey, isOpen: Bool = false, generatedAt: String = "2026-10-01T12:00:00Z",
                         details: PeriodSummaryDetails = .empty) -> PeriodSummary {
        PeriodSummary(key: key, title: "The lease got real", sentence: "You signed and started packing.",
                      summary: "A week of boxes.", generatedAt: at(generatedAt), sourceCount: 1,
                      sourceFingerprint: "f", isOpen: isOpen, model: "m", promptVersion: 1, details: details)
    }

    private func make(_ summary: PeriodSummary?, _ key: PeriodKey, childCount: Int, today: Int,
                      timeZone: TimeZone? = nil) -> StoryMapCaption {
        StoryMapCaption.make(summary: summary, key: key, childCount: childCount, entriesById: entries,
                             today: today, timeZone: timeZone ?? utc)
    }

    func testClosedPeriodWithSummary() {
        let caption = make(summary(september), september, childCount: 4, today: day(2026, 10, 2))
        XCTAssertEqual(caption.key, september)
        XCTAssertEqual(caption.labelLine, "September 2026 · 4 weeks")
        XCTAssertEqual(caption.title, "The lease got real")
        XCTAssertEqual(caption.sentence, "You signed and started packing.")
        XCTAssertEqual(caption.summary, "A week of boxes.")
        XCTAssertNil(caption.quote)
        XCTAssertNil(caption.highPoint)
        XCTAssertFalse(caption.isStandout)
    }

    func testOpenPeriodShowsAsOfInTheProfileTimezone() {
        // Written 23:30 UTC Wed 23 Sep, which is 07:30 Thu 24 Sep in Kuala Lumpur.
        let open = summary(week39, isOpen: true, generatedAt: "2026-09-23T23:30:00Z")
        XCTAssertEqual(make(open, week39, childCount: 5, today: day(2026, 9, 26), timeZone: kl).labelLine,
                       "Week of Mon 21 Sep 2026 · 5 days · so far · as of Thu 24 Sep")
        XCTAssertEqual(make(open, week39, childCount: 5, today: day(2026, 9, 26), timeZone: utc).labelLine,
                       "Week of Mon 21 Sep 2026 · 5 days · so far · as of Wed 23 Sep")
    }

    func testAsOfIsOmittedWhenWrittenToday() {
        let open = summary(week39, isOpen: true, generatedAt: "2026-09-26T01:00:00Z")
        XCTAssertEqual(make(open, week39, childCount: 5, today: day(2026, 9, 26), timeZone: kl).labelLine,
                       "Week of Mon 21 Sep 2026 · 5 days · so far")
    }

    func testMissingSummary() {
        let caption = make(nil, week39, childCount: 1, today: day(2026, 9, 26))
        XCTAssertEqual(caption.labelLine, "Week of Mon 21 Sep 2026 · 1 day · so far")
        XCTAssertNil(caption.title)
        XCTAssertNil(caption.sentence)
        XCTAssertNil(caption.summary)
        XCTAssertFalse(caption.isStandout)
    }

    func testFirstLiveAnchorAndHighPoint() {
        let details = PeriodSummaryDetails(
            salience: 6,
            anchors: [PeriodSummaryAnchor(entryId: "deleted", quote: "Gone now."),
                      PeriodSummaryAnchor(entryId: "e3", quote: "I finally said it out loud."),
                      PeriodSummaryAnchor(entryId: "e5", quote: "The air was cool.")],
            keyScenes: PeriodSummaryKeyScenes(high: "e5", low: nil, turning: "e3"),
            threads: []
        )
        let caption = make(summary(week39, details: details), week39, childCount: 5, today: day(2026, 10, 2))
        XCTAssertEqual(caption.quote, StoryMapQuote(entryId: "e3", quote: "I finally said it out loud.",
                                                    attribution: "Tue 22 Sep 2026"))
        XCTAssertEqual(caption.highPoint, StoryMapHighPoint(entryId: "e5", title: "Evening walk",
                                                            attribution: "Thu 24 Sep 2026"))
    }

    func testGroundingIsOmittedWhenItsEntryIsGone() {
        let details = PeriodSummaryDetails(
            salience: 6,
            anchors: [PeriodSummaryAnchor(entryId: "deleted", quote: "Gone now.")],
            keyScenes: PeriodSummaryKeyScenes(high: "deleted", low: nil, turning: nil),
            threads: []
        )
        let caption = make(summary(week39, details: details), week39, childCount: 5, today: day(2026, 10, 2))
        XCTAssertNil(caption.quote)
        XCTAssertNil(caption.highPoint)
    }

    func testStandoutAtSalienceEight() {
        func details(_ salience: Int) -> PeriodSummaryDetails {
            PeriodSummaryDetails(salience: salience, anchors: [], keyScenes: .none, threads: [])
        }
        XCTAssertTrue(make(summary(week39, details: details(8)), week39, childCount: 5, today: day(2026, 10, 2)).isStandout)
        XCTAssertFalse(make(summary(week39, details: details(7)), week39, childCount: 5, today: day(2026, 10, 2)).isStandout)
    }

    func testLifetimeIsAllTime() {
        XCTAssertEqual(make(nil, PeriodKey(.all, 0), childCount: 2, today: day(2026, 10, 2)).labelLine,
                       "All time · 2 years · so far")
    }

    func testDayCountsEntries() {
        XCTAssertEqual(make(nil, PeriodKey(.day, day(2026, 9, 24)), childCount: 3, today: day(2026, 10, 2)).labelLine,
                       "Thu 24 Sep 2026 · 3 entries")
    }
}
