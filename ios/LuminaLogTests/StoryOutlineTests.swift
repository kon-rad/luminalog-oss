import XCTest
@testable import LuminaLog

final class StoryOutlineTests: XCTestCase {

    private let utc = TimeZone(identifier: "UTC")!

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = utc
        return Int(floor(cal.date(from: DateComponents(year: y, month: m, day: d))!.timeIntervalSince1970 / 86_400))
    }

    private func at(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    private func entry(_ id: String, _ iso: String, title: String? = nil, content: String = "Body") -> JournalEntry {
        JournalEntry(
            id: id, userId: "u", type: .text, title: title ?? id,
            createdAt: at(iso), updatedAt: at(iso), content: content,
            summary: content.trimmingCharacters(in: .whitespaces).isEmpty
                ? nil : AIGeneration(text: "Entry \(id)", generatedAt: at(iso))
        )
    }

    /// e1 in 2025; e2 in ISO week 39 (September); e3 Tue 29 Sep and e4/e5 Thu 1 Oct,
    /// both in ISO week 40, which straddles September and October.
    private var fixture: [JournalEntry] {
        [
            entry("e1", "2025-12-31T10:00:00Z"),
            entry("e2", "2026-09-21T09:00:00Z"),
            entry("e3", "2026-09-29T08:00:00Z"),
            entry("e4", "2026-10-01T07:00:00Z"),
            entry("e5", "2026-10-01T20:00:00Z"),
        ]
    }

    private let sept = PeriodKey(.month, 2026 * 12 + 8)
    private let oct = PeriodKey(.month, 2026 * 12 + 9)
    private let week40 = PeriodKey(.week, 202640)
    private let week39 = PeriodKey(.week, 202639)
    private let q3 = PeriodKey(.quarter, 2026 * 4 + 2)
    private let standout = PeriodSummaryDetails(salience: 9, anchors: [], keyScenes: .none, threads: [])

    private func build(_ entries: [JournalEntry], summaries: [PeriodSummary] = [],
                       today: Int? = nil, tz: TimeZone? = nil) -> StoryNode? {
        StoryOutline.build(
            entries: entries,
            summaries: Dictionary(summaries.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a }),
            today: today ?? day(2026, 10, 2),
            timeZone: tz ?? utc
        )
    }

    private func node(_ root: StoryNode, _ id: String) -> StoryNode? {
        if root.id == id { return root }
        for child in root.children { if let found = node(child, id) { return found } }
        return nil
    }

    private func summary(_ key: PeriodKey, isOpen: Bool = false, generatedAt: String = "2026-10-01T12:00:00Z",
                         details: PeriodSummaryDetails = .empty) -> PeriodSummary {
        PeriodSummary(key: key, title: "Title \(key)", sentence: "Sentence \(key).", summary: "Summary \(key).",
                      generatedAt: at(generatedAt), sourceCount: 1, sourceFingerprint: "f",
                      isOpen: isOpen, model: "m", promptVersion: 1, details: details)
    }

    func testNoUsableEntriesBuildsNothing() {
        XCTAssertNil(build([]))
        XCTAssertNil(build([entry("blank", "2026-10-01T07:00:00Z", content: "   ")]))
    }

    func testHierarchyIsNewestFirstAtEveryLevel() throws {
        let root = try XCTUnwrap(build(fixture))
        XCTAssertEqual(root.id, "all_0")
        XCTAssertEqual(root.label, "All time")
        XCTAssertEqual(root.entryCount, 5)
        XCTAssertEqual(root.children.map(\.id), ["year_2026", "year_2025"])
        let y2026 = try XCTUnwrap(node(root, "year_2026"))
        XCTAssertEqual(y2026.children.map(\.id), ["quarter_\(2026 * 4 + 3)", "quarter_\(2026 * 4 + 2)"])
        let q3 = try XCTUnwrap(node(root, "quarter_\(2026 * 4 + 2)"))
        XCTAssertEqual(q3.children.map(\.id), [sept.docId])
        let september = try XCTUnwrap(node(root, sept.docId))
        XCTAssertEqual(september.label, "September 2026")
        XCTAssertEqual(september.children.map(\.id), ["\(week40.docId)@\(sept.docId)", "\(week39.docId)@\(sept.docId)"])
    }

    func testStraddlingWeekAppearsUnderBothMonthsWithItsOwnDays() throws {
        let root = try XCTUnwrap(build(fixture))
        let inSept = try XCTUnwrap(node(root, "\(week40.docId)@\(sept.docId)"))
        let inOct = try XCTUnwrap(node(root, "\(week40.docId)@\(oct.docId)"))
        XCTAssertEqual(inSept.children.map(\.id), ["day_\(day(2026, 9, 29))"])
        XCTAssertEqual(inOct.children.map(\.id), ["day_\(day(2026, 10, 1))"])
        XCTAssertEqual(inSept.continuation, .continuesInto("October 2026"))
        XCTAssertEqual(inOct.continuation, .continuedFrom("September 2026"))
        // The week's text and count cover the whole week in both places.
        XCTAssertEqual(inSept.entryCount, 3)
        XCTAssertEqual(inOct.entryCount, 3)
        XCTAssertEqual(inSept.label, "Week of Mon 28 Sep 2026")
        XCTAssertEqual(inOct.label, "Week of Mon 28 Sep 2026")
        let week39Node = try XCTUnwrap(node(root, "\(week39.docId)@\(sept.docId)"))
        XCTAssertEqual(week39Node.continuation, StoryContinuation.none)
    }

    func testDaysListEntriesNewestFirstWithLocalTimes() throws {
        let root = try XCTUnwrap(build(fixture))
        let thursday = try XCTUnwrap(node(root, "day_\(day(2026, 10, 1))"))
        XCTAssertEqual(thursday.label, "Thu 1 Oct 2026")
        XCTAssertEqual(thursday.entryCount, 2)
        XCTAssertEqual(thursday.children.map(\.id), ["entry_e5", "entry_e4"])
        XCTAssertEqual(thursday.children.map(\.label), ["20:00", "07:00"])
        let e5 = thursday.children[0]
        XCTAssertEqual(e5.kind, .entry)
        XCTAssertEqual(e5.entryId, "e5")
        XCTAssertEqual(e5.entryType, .text)
        XCTAssertFalse(e5.hasChildren)
    }

    func testUntitledEntryIsLabelledUntitled() throws {
        let root = try XCTUnwrap(build([entry("e1", "2026-10-01T07:00:00Z", title: "  ")]))
        let entryNode = try XCTUnwrap(node(root, "entry_e1"))
        XCTAssertEqual(entryNode.title, "Untitled")
    }

    func testEarlyMorningInUTCPlus8LandsOnTheLocalDay() throws {
        let kl = TimeZone(identifier: "Asia/Kuala_Lumpur")!
        // 07:30 local on Sat 26 Sep is 23:30 UTC on Fri 25 Sep.
        let root = try XCTUnwrap(build([entry("e1", "2026-09-25T23:30:00Z")], today: day(2026, 9, 26), tz: kl))
        let saturday = try XCTUnwrap(node(root, "day_\(day(2026, 9, 26))"))
        XCTAssertEqual(saturday.children.map(\.label), ["07:30"])
        XCTAssertNil(node(root, "day_\(day(2026, 9, 25))"))
    }

    func testSummariesOverlayOntoTheirNodes() throws {
        let root = try XCTUnwrap(build(fixture, summaries: [summary(week40, isOpen: true)]))
        for id in ["\(week40.docId)@\(sept.docId)", "\(week40.docId)@\(oct.docId)"] {
            let week = try XCTUnwrap(node(root, id))
            XCTAssertEqual(week.title, "Title \(week40)")
            XCTAssertEqual(week.sentence, "Sentence \(week40).")
            XCTAssertEqual(week.summary, "Summary \(week40).")
            XCTAssertEqual(week.openAsOfDay, day(2026, 10, 1))
            XCTAssertTrue(week.isCurrent)
        }
        let september = try XCTUnwrap(node(root, sept.docId))
        XCTAssertNil(september.title)
        XCTAssertNil(september.openAsOfDay)
        XCTAssertFalse(september.isCurrent)
    }

    func testDetailsResolveToLiveEntriesWithAttribution() throws {
        let details = PeriodSummaryDetails(
            salience: 9,
            anchors: [PeriodSummaryAnchor(entryId: "e3", quote: "I finally said it out loud."),
                      PeriodSummaryAnchor(entryId: "deleted", quote: "Gone now.")],
            keyScenes: PeriodSummaryKeyScenes(high: "e5", low: "deleted", turning: "e3"),
            threads: ["Forest City move"]
        )
        let root = try XCTUnwrap(build(fixture, summaries: [summary(week40, isOpen: true, details: details)]))
        let week = try XCTUnwrap(node(root, "\(week40.docId)@\(sept.docId)"))
        XCTAssertEqual(week.salience, 9)
        XCTAssertTrue(week.isStandout)
        XCTAssertEqual(week.quotes, [StoryQuote(entryId: "e3", quote: "I finally said it out loud.",
                                                attribution: "Tue 29 Sep 2026 · e3")])
        XCTAssertEqual(week.keyMoments, [
            StoryKeyMoment(kind: .high, entryId: "e5", title: "e5", attribution: "Thu 1 Oct 2026"),
            StoryKeyMoment(kind: .turning, entryId: "e3", title: "e3", attribution: "Tue 29 Sep 2026"),
        ])
        XCTAssertEqual(week.threads, ["Forest City move"])
        let september = try XCTUnwrap(node(root, sept.docId))
        XCTAssertNil(september.salience)
        XCTAssertFalse(september.isStandout)
        XCTAssertTrue(september.quotes.isEmpty)
    }

    func testClosedSummaryHasNoAsOfDay() throws {
        let root = try XCTUnwrap(build(fixture, summaries: [summary(week39, isOpen: false)]))
        XCTAssertNil(try XCTUnwrap(node(root, "\(week39.docId)@\(sept.docId)")).openAsOfDay)
    }

    func testDefaultExpansionOpensThePathToTheCurrentMonth() throws {
        let root = try XCTUnwrap(build(fixture))
        XCTAssertEqual(StoryOutline.defaultExpanded(root, today: day(2026, 10, 2)),
                       ["all_0", "year_2026", "quarter_\(2026 * 4 + 3)", oct.docId])
    }

    func testDefaultExpansionFallsBackToTheLatestMonth() throws {
        let today = day(2026, 11, 1)
        let root = try XCTUnwrap(build(fixture, today: today))
        XCTAssertEqual(StoryOutline.defaultExpanded(root, today: today),
                       ["all_0", "year_2026", "quarter_\(2026 * 4 + 3)", oct.docId])
    }

    func testVisibleRowsFollowExpansionWithDepths() throws {
        let root = try XCTUnwrap(build(fixture))
        let rows = StoryOutline.visibleRows(root, expanded: StoryOutline.defaultExpanded(root, today: day(2026, 10, 2)))
        XCTAssertEqual(rows.map(\.id), [
            "all_0", "year_2026", "quarter_\(2026 * 4 + 3)", oct.docId,
            "\(week40.docId)@\(oct.docId)", "quarter_\(2026 * 4 + 2)", "year_2025",
        ])
        XCTAssertEqual(rows.map(\.depth), [0, 1, 2, 3, 4, 2, 1])
        XCTAssertEqual(StoryOutline.visibleRows(root, expanded: []).map(\.id), ["all_0"])
        XCTAssertTrue(StoryOutline.visibleRows(nil, expanded: ["all_0"]).isEmpty)
    }

    func testLabelLine() throws {
        let root = try XCTUnwrap(build(fixture))
        XCTAssertEqual(StoryOutline.labelLine(try XCTUnwrap(node(root, oct.docId))), "October 2026 · 2 entries · so far")
        XCTAssertEqual(StoryOutline.labelLine(try XCTUnwrap(node(root, "year_2025"))), "2025 · 1 entry")
    }

    // MARK: - Home rows

    private func homeRows(_ summaries: [PeriodSummary], entries: [JournalEntry]? = nil,
                          today: Int? = nil, tz: TimeZone? = nil) -> [StoryHomeRow] {
        StoryOutline.homeRows(summaries: summaries, entries: entries ?? fixture,
                              today: today ?? day(2026, 10, 2), timeZone: tz ?? utc)
    }

    func testHomeRowsShowThisWeekLastMonthAndLastQuarter() {
        let today = day(2026, 10, 2)
        XCTAssertEqual(StoryOutline.homeKeys(today: today), [week40, week39, sept, q3])
        XCTAssertEqual(StoryOutline.homeEntriesStartDay(today: today), day(2026, 7, 1))

        let week = summary(week40, isOpen: true, generatedAt: "2026-10-02T06:00:00Z")
        let month = summary(sept, details: standout)
        let quarter = summary(q3)
        // Input order doesn't matter; the rows are always week, month, quarter.
        XCTAssertEqual(homeRows([quarter, week, month]), [
            StoryHomeRow(key: week40, label: "This week so far · 3 entries",
                         title: week.title, sentence: week.sentence, isStandout: false),
            StoryHomeRow(key: sept, label: "September 2026 · 2 entries",
                         title: month.title, sentence: month.sentence, isStandout: true),
            StoryHomeRow(key: q3, label: "Q3 2026 · 2 entries",
                         title: quarter.title, sentence: quarter.sentence, isStandout: false),
        ])
    }

    func testHomeRowsSayAsOfOnlyWhenTheWeekWasWrittenBeforeToday() {
        // Written Thu 1 Oct, read Fri 2 Oct.
        XCTAssertEqual(homeRows([summary(week40, isOpen: true, generatedAt: "2026-10-01T12:00:00Z")]).map(\.label),
                       ["This week so far · 3 entries · as of Thu"])
        // The local day decides: 23:30 UTC on Thu 1 Oct is 07:30 on Fri 2 Oct in UTC+8, so today.
        let kl = TimeZone(identifier: "Asia/Kuala_Lumpur")!
        XCTAssertEqual(homeRows([summary(week40, isOpen: true, generatedAt: "2026-10-01T23:30:00Z")], tz: kl).map(\.label),
                       ["This week so far · 3 entries"])
    }

    func testHomeRowsFallBackToLastWeek() {
        let lastWeek = summary(week39)
        let rows = homeRows([lastWeek])
        XCTAssertEqual(rows, [StoryHomeRow(key: week39, label: "Last week · 1 entry",
                                           title: lastWeek.title, sentence: lastWeek.sentence, isStandout: false)])
        // This week wins when both exist; last week is not shown as well.
        XCTAssertEqual(homeRows([lastWeek, summary(week40, isOpen: true)]).map(\.key), [week40])
    }

    func testHomeRowsHideMissingPeriods() {
        XCTAssertTrue(homeRows([]).isEmpty)
        XCTAssertEqual(homeRows([summary(q3)]).map(\.key), [q3])
        XCTAssertEqual(homeRows([summary(week40, isOpen: true), summary(q3)]).map(\.key), [week40, q3])
        // Other periods never fill a gap: this month and all time are not "last month".
        XCTAssertTrue(homeRows([summary(oct, isOpen: true), summary(PeriodKey(.all, 0), isOpen: true)]).isEmpty)
    }

    func testHomeRowsOnFirstJanuaryPickDecemberAndQ4OfTheYearBefore() {
        let today = day(2027, 1, 1)
        let december = PeriodKey(.month, 2026 * 12 + 11)
        let q4 = PeriodKey(.quarter, 2026 * 4 + 3)
        XCTAssertEqual(StoryOutline.homeKeys(today: today), [
            PeriodSummaryIndex.key(.week, forDay: today),
            PeriodSummaryIndex.key(.week, forDay: day(2026, 12, 25)),
            december,
            q4,
        ])
        XCTAssertEqual(StoryOutline.homeEntriesStartDay(today: today), day(2026, 10, 1))
        // e1 (31 Dec 2025) is a different December and must not be counted.
        let entries = fixture + [entry("d1", "2026-12-24T09:00:00Z")]
        XCTAssertEqual(homeRows([summary(december), summary(q4)], entries: entries, today: today).map(\.label),
                       ["December 2026 · 1 entry", "Q4 2026 · 3 entries"])
    }

    func testHomeRowAccessibilityLabel() {
        let row = StoryHomeRow(key: sept, label: "September 2026 · 2 entries", title: "The move",
                               sentence: "You moved.", isStandout: true)
        XCTAssertEqual(row.accessibilityLabel, "September 2026 · 2 entries, The move, a standout period. You moved.")
        let plain = StoryHomeRow(key: sept, label: "September 2026 · 2 entries", title: "The move",
                                 sentence: "You moved.", isStandout: false)
        XCTAssertEqual(plain.accessibilityLabel, "September 2026 · 2 entries, The move. You moved.")
    }

    // MARK: - Focus

    func testFocusOnAMonthOpensItsPath() throws {
        let root = try XCTUnwrap(build(fixture))
        XCTAssertEqual(StoryOutline.expanded(for: sept, in: root),
                       ["all_0", "year_2026", "quarter_\(2026 * 4 + 2)", sept.docId])
        XCTAssertEqual(StoryOutline.nodeId(for: sept, in: root), sept.docId)
    }

    func testFocusOnAStraddlingWeekOpensItUnderItsThursdaysMonth() throws {
        // Week 40's Thursday is 1 Oct, so the October listing is the one opened.
        let root = try XCTUnwrap(build(fixture))
        let inOct = "\(week40.docId)@\(oct.docId)"
        XCTAssertEqual(StoryOutline.expanded(for: week40, in: root),
                       ["all_0", "year_2026", "quarter_\(2026 * 4 + 3)", oct.docId, inOct])
        XCTAssertEqual(StoryOutline.nodeId(for: week40, in: root), inOct)
        // With no October days, the week is only listed under September: use that.
        let septOnly = try XCTUnwrap(build([entry("e3", "2026-09-29T08:00:00Z")]))
        XCTAssertEqual(StoryOutline.nodeId(for: week40, in: septOnly), "\(week40.docId)@\(sept.docId)")
    }

    func testFocusOnADayOpensEveryLevelDownToIt() throws {
        let root = try XCTUnwrap(build(fixture))
        let tuesday = PeriodKey(.day, day(2026, 9, 29))
        XCTAssertEqual(StoryOutline.expanded(for: tuesday, in: root), [
            "all_0", "year_2026", "quarter_\(2026 * 4 + 2)", sept.docId,
            "\(week40.docId)@\(sept.docId)", tuesday.docId,
        ])
        XCTAssertEqual(StoryOutline.nodeId(for: tuesday, in: root), tuesday.docId)
    }

    func testFocusOnAPeriodNotInTheOutlineOpensNothing() throws {
        let root = try XCTUnwrap(build(fixture))
        let june = PeriodKey(.month, 2026 * 12 + 5)
        XCTAssertTrue(StoryOutline.expanded(for: june, in: root).isEmpty)
        XCTAssertNil(StoryOutline.nodeId(for: june, in: root))
    }

    // MARK: - Final-review fixes

    func testTimeLabelUsesTheGivenZone() {
        let date = at("2026-10-01T03:05:00Z")
        XCTAssertEqual(StoryOutline.timeLabel(date, utc), "03:05")
        XCTAssertEqual(StoryOutline.timeLabel(date, TimeZone(identifier: "America/New_York")!), "23:05")
        XCTAssertEqual(StoryOutline.timeLabel(date, TimeZone(identifier: "Asia/Kolkata")!), "08:35")
    }

    func testWeekStraddlingTheYearBoundaryAppearsUnderDecemberAndJanuary() throws {
        // ISO 2026-W53 runs Mon 28 Dec 2026 to Sun 3 Jan 2027; its Thursday is 31 Dec.
        let entries = [entry("d1", "2026-12-29T09:00:00Z"), entry("j1", "2027-01-02T09:00:00Z")]
        let today = day(2027, 1, 2)
        let root = try XCTUnwrap(build(entries, today: today))
        let week53 = PeriodSummaryIndex.key(.week, forDay: day(2026, 12, 31))
        XCTAssertEqual(week53, PeriodKey(.week, 202653))
        XCTAssertEqual(PeriodSummaryIndex.key(.week, forDay: day(2027, 1, 2)), week53)
        let december = PeriodKey(.month, 2026 * 12 + 11)
        let january = PeriodKey(.month, 2027 * 12)
        let inDec = try XCTUnwrap(node(root, "\(week53.docId)@\(december.docId)"))
        let inJan = try XCTUnwrap(node(root, "\(week53.docId)@\(january.docId)"))
        XCTAssertEqual(inDec.children.map(\.id), ["day_\(day(2026, 12, 29))"])
        XCTAssertEqual(inJan.children.map(\.id), ["day_\(day(2027, 1, 2))"])
        XCTAssertEqual(inDec.continuation, .continuesInto("January 2027"))
        XCTAssertEqual(inJan.continuation, .continuedFrom("December 2026"))
        XCTAssertEqual(inDec.label, "Week of Mon 28 Dec 2026")
        XCTAssertEqual(inJan.label, "Week of Mon 28 Dec 2026")
        // Focus opens the December listing, the month holding Thursday 31 Dec.
        XCTAssertEqual(StoryOutline.expanded(for: week53, in: root), [
            "all_0", "year_2026", "quarter_\(2026 * 4 + 3)", december.docId, inDec.id,
        ])
        XCTAssertEqual(StoryOutline.nodeId(for: week53, in: root), inDec.id)
    }

    func testQuotesAreCappedAtThree() throws {
        let anchors = ["e2", "e3", "e4", "e5"].map { PeriodSummaryAnchor(entryId: $0, quote: "Quote \($0)") }
        let details = PeriodSummaryDetails(salience: nil, anchors: anchors, keyScenes: .none, threads: [])
        let root = try XCTUnwrap(build(fixture, summaries: [summary(PeriodKey(.all, 0), isOpen: true, details: details)]))
        XCTAssertEqual(root.quotes.map(\.entryId), ["e2", "e3", "e4"])
    }

    func testHomeRowsDoNotSayAsOfWhenWrittenAfterToday() {
        // Written Sat 3 Oct (a clock or zone change), read Fri 2 Oct: not "as of".
        XCTAssertEqual(homeRows([summary(week40, isOpen: true, generatedAt: "2026-10-03T12:00:00Z")]).map(\.label),
                       ["This week so far · 3 entries"])
    }

    func testHomeRowsWithoutCompleteCountsDropTheEntryCount() {
        let rows = StoryOutline.homeRows(
            summaries: [summary(week40, isOpen: true, generatedAt: "2026-10-01T12:00:00Z"), summary(sept), summary(q3)],
            entries: fixture, today: day(2026, 10, 2), timeZone: utc, countsComplete: false)
        XCTAssertEqual(rows.map(\.label), ["This week so far · as of Thu", "September 2026", "Q3 2026"])
        XCTAssertEqual(StoryOutline.homeRows(summaries: [summary(week39)], entries: [], today: day(2026, 10, 2),
                                             timeZone: utc, countsComplete: false).map(\.label), ["Last week"])
    }

    func testHomeCacheKeyChangesOnlyWithTodaySummariesOrTheNewestEntry() {
        let today = day(2026, 10, 2)
        let week = summary(week40, isOpen: true, generatedAt: "2026-10-01T12:00:00Z")
        let month = summary(sept)
        let newest = fixture[4]
        let key = StoryOutline.homeCacheKey(today: today, summaries: [week, month], newestEntry: newest)
        // Same inputs, any summary order: no recount.
        XCTAssertFalse(StoryOutline.homeNeedsRecount(
            cached: key, current: StoryOutline.homeCacheKey(today: today, summaries: [month, week], newestEntry: newest)))
        XCTAssertTrue(StoryOutline.homeNeedsRecount(cached: nil, current: key))
        XCTAssertTrue(StoryOutline.homeNeedsRecount(
            cached: key, current: StoryOutline.homeCacheKey(today: today + 1, summaries: [week, month], newestEntry: newest)))
        let rewritten = summary(week40, isOpen: true, generatedAt: "2026-10-02T08:00:00Z")
        XCTAssertTrue(StoryOutline.homeNeedsRecount(
            cached: key, current: StoryOutline.homeCacheKey(today: today, summaries: [rewritten, month], newestEntry: newest)))
        XCTAssertTrue(StoryOutline.homeNeedsRecount(
            cached: key, current: StoryOutline.homeCacheKey(today: today, summaries: [week], newestEntry: newest)))
        XCTAssertTrue(StoryOutline.homeNeedsRecount(
            cached: key, current: StoryOutline.homeCacheKey(today: today, summaries: [week, month],
                                                             newestEntry: entry("e6", "2026-10-02T07:00:00Z"))))
        XCTAssertTrue(StoryOutline.homeNeedsRecount(
            cached: key, current: StoryOutline.homeCacheKey(today: today, summaries: [week, month], newestEntry: nil)))
    }

    // MARK: - Home entry paging

    /// Pages of `entries` (newest first) the way `entries(after:limit:)` serves them,
    /// minus `undecodable` ids, which the repository drops from a page.
    private func pager(_ entries: [JournalEntry], undecodable: Set<String> = [])
        -> (Date?, Int) async throws -> [JournalEntry] {
        let sorted = entries.sorted { $0.createdAt > $1.createdAt }
        return { after, limit in
            Array(sorted.filter { after == nil || $0.createdAt < after! }.prefix(limit))
                .filter { !undecodable.contains($0.id) }
        }
    }

    private func dailyEntries(from start: Int, count: Int) -> [JournalEntry] {
        (0..<count).map { i in
            let date = Date(timeIntervalSince1970: TimeInterval(start + i) * 86_400 + 9 * 3_600)
            return JournalEntry(id: "p\(i)", userId: "u", type: .text, title: "p\(i)", createdAt: date,
                                updatedAt: date, content: "Body",
                                summary: AIGeneration(text: "Entry p\(i)", generatedAt: date))
        }
    }

    func testHomeEntryPagingKeepsGoingPastAShortPage() async throws {
        // Page 1 has an undecodable doc, so it comes back short; paging must not stop there.
        let all = dailyEntries(from: day(2026, 9, 1), count: 5)
        let result = await StoryOutline.homeEntries(
            since: day(2026, 7, 1), timeZone: utc, pageSize: 2, maxPages: 10,
            fetch: pager(all, undecodable: ["p4"]))
        let loaded = try XCTUnwrap(result)
        XCTAssertEqual(loaded.entries.map(\.id), ["p3", "p2", "p1", "p0"])
        XCTAssertTrue(loaded.countsComplete)
    }

    func testHomeEntryPagingStopsOnceAPageReachesTheStartDay() async throws {
        let all = dailyEntries(from: day(2026, 6, 20), count: 20)   // 20 Jun to 9 Jul
        var calls = 0
        let fetch = pager(all)
        let result = await StoryOutline.homeEntries(
            since: day(2026, 7, 1), timeZone: utc, pageSize: 4, maxPages: 10,
            fetch: { after, limit in calls += 1; return try await fetch(after, limit) })
        let loaded = try XCTUnwrap(result)
        XCTAssertTrue(loaded.countsComplete)
        XCTAssertEqual(calls, 3)   // 9..6 Jul, 5..2 Jul, 1 Jul..28 Jun: that page reaches June
    }

    func testHomeEntryPagingAtThePageCapReportsIncompleteCounts() async throws {
        let all = dailyEntries(from: day(2026, 8, 1), count: 30)
        let result = await StoryOutline.homeEntries(
            since: day(2026, 7, 1), timeZone: utc, pageSize: 5, maxPages: 2, fetch: pager(all))
        let loaded = try XCTUnwrap(result)
        XCTAssertEqual(loaded.entries.count, 10)
        XCTAssertFalse(loaded.countsComplete)
    }

    func testHomeEntryPagingReturnsNilWhenAReadFails() async {
        struct Boom: Error {}
        let result = await StoryOutline.homeEntries(
            since: day(2026, 7, 1), timeZone: utc, pageSize: 5, maxPages: 2, fetch: { _, _ in throw Boom() })
        XCTAssertNil(result)
    }
}
