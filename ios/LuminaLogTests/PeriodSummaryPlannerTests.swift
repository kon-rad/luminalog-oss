import XCTest
@testable import LuminaLog

final class PeriodSummaryPlannerTests: XCTestCase {

    private let utc = TimeZone(identifier: "UTC")!

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = utc
        return Int(floor(cal.date(from: DateComponents(year: y, month: m, day: d))!.timeIntervalSince1970 / 86_400))
    }

    private func at(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    private func entry(_ id: String, _ iso: String, summary: String? = "An entry summary.", content: String = "Body") -> JournalEntry {
        JournalEntry(
            id: id, userId: "u", type: .text, title: id,
            createdAt: at(iso), updatedAt: at(iso), content: content,
            summary: summary.map { AIGeneration(text: $0, generatedAt: at(iso)) }
        )
    }

    /// A fresh stored doc for `key` given the current tree and docs.
    private func fresh(_ key: PeriodKey, _ tree: PeriodSummaryPlanner.Tree, _ existing: [PeriodKey: PeriodSummary],
                       isOpen: Bool = false, generatedAt: Date = Date(timeIntervalSince1970: 1_790_000_000)) -> PeriodSummary {
        PeriodSummary(key: key, title: "T \(key)", sentence: "S \(key)", summary: "Summary \(key)", generatedAt: generatedAt,
                      sourceCount: 1, sourceFingerprint: PeriodSummaryPlanner.fingerprint(for: key, tree: tree, existing: existing),
                      isOpen: isOpen, model: "m", promptVersion: PeriodSummaryPlanner.promptVersion,
                      details: PeriodSummaryDetails(
                          salience: 6, anchors: [PeriodSummaryAnchor(entryId: "q-\(key)", quote: "Quote \(key)")],
                          keyScenes: .none, threads: ["Thread \(key.type.rawValue)"]))
    }

    private var today: Int { day(2026, 9, 26) }

    private func next(_ entries: [JournalEntry], _ existing: [PeriodKey: PeriodSummary] = [:],
                      includeOpen: Bool = false, excluding: Set<PeriodKey> = []) -> PeriodSummaryWorkItem? {
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        return PeriodSummaryPlanner.next(tree: tree, existing: existing, today: today, timeZone: utc,
                                         includeOpen: includeOpen, excluding: excluding)
    }

    func testNoEntriesMeansNoWork() {
        XCTAssertNil(next([]))
    }

    func testClosedRunPicksTheNewestClosedDayAndSkipsToday() {
        let entries = [entry("a", "2026-09-21T10:00:00Z"), entry("b", "2026-09-22T10:00:00Z"), entry("c", "2026-09-26T10:00:00Z")]
        XCTAssertEqual(next(entries)?.key, PeriodKey(.day, day(2026, 9, 22)))
    }

    func testIncludeOpenAllowsTodayFirst() {
        let entries = [entry("a", "2026-09-22T10:00:00Z"), entry("c", "2026-09-26T10:00:00Z")]
        let item = next(entries, includeOpen: true)
        XCTAssertEqual(item?.key, PeriodKey(.day, today))
        XCTAssertEqual(item?.isOpen, true)
        XCTAssertNil(next([entry("c", "2026-09-26T10:00:00Z")]))
    }

    func testParentWaitsUntilEveryChildIsFresh() {
        // Week 38 (14-20 Sep) is closed; Sep and every tier above are open (today is 26 Sep).
        let entries = [entry("a", "2026-09-14T10:00:00Z"), entry("b", "2026-09-15T10:00:00Z")]
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        var existing: [PeriodKey: PeriodSummary] = [:]
        let d15 = PeriodKey(.day, day(2026, 9, 15)), d14 = PeriodKey(.day, day(2026, 9, 14))
        existing[d15] = fresh(d15, tree, existing)
        XCTAssertEqual(next(entries, existing)?.key, d14)
        existing[d14] = fresh(d14, tree, existing)
        XCTAssertEqual(next(entries, existing)?.key, PeriodKey(.week, 202638))
    }

    func testEverythingFreshMeansNoWork() {
        let entries = [entry("a", "2026-09-14T10:00:00Z")]
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        var existing: [PeriodKey: PeriodSummary] = [:]
        let d = PeriodKey(.day, day(2026, 9, 14))
        existing[d] = fresh(d, tree, existing)
        existing[PeriodKey(.week, 202638)] = fresh(PeriodKey(.week, 202638), tree, existing)
        XCTAssertNil(next(entries, existing))
    }

    func testEditingAnEntryMakesItsDayStale() {
        var e = entry("a", "2026-09-14T10:00:00Z")
        let d = PeriodKey(.day, day(2026, 9, 14))
        let tree = PeriodSummaryPlanner.tree(entries: [e], timeZone: utc)
        var existing: [PeriodKey: PeriodSummary] = [:]
        existing[d] = fresh(d, tree, existing)
        existing[PeriodKey(.week, 202638)] = fresh(PeriodKey(.week, 202638), tree, existing)
        e.contentEditedAt = at("2026-09-20T09:00:00Z")
        XCTAssertEqual(next([e], existing)?.key, d)
    }

    func testRegeneratedChildMakesItsParentStale() {
        let entries = [entry("a", "2026-09-14T10:00:00Z")]
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        var existing: [PeriodKey: PeriodSummary] = [:]
        let d = PeriodKey(.day, day(2026, 9, 14)), w = PeriodKey(.week, 202638)
        existing[d] = fresh(d, tree, existing)
        existing[w] = fresh(w, tree, existing)
        existing[d] = fresh(d, tree, existing, generatedAt: Date(timeIntervalSince1970: 1_790_000_999))
        XCTAssertEqual(next(entries, existing)?.key, w)
    }

    func testDocGeneratedWhileOpenRegeneratesOnceClosed() {
        let entries = [entry("a", "2026-09-25T10:00:00Z")]
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        let d = PeriodKey(.day, day(2026, 9, 25))
        let existing = [d: fresh(d, tree, [:], isOpen: true)]
        let item = next(entries, existing)
        XCTAssertEqual(item?.key, d)
        XCTAssertEqual(item?.isOpen, false)
    }

    func testOlderPromptVersionRegenerates() {
        let entries = [entry("a", "2026-09-25T10:00:00Z")]
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        let d = PeriodKey(.day, day(2026, 9, 25))
        var doc = fresh(d, tree, [:])
        doc.promptVersion = PeriodSummaryPlanner.promptVersion - 1
        XCTAssertEqual(next(entries, [d: doc])?.key, d)
    }

    func testExcludedPeriodIsSkippedAndItsParentWaits() {
        let entries = [entry("a", "2026-09-14T10:00:00Z"), entry("b", "2026-09-15T10:00:00Z")]
        let d15 = PeriodKey(.day, day(2026, 9, 15))
        XCTAssertEqual(next(entries, excluding: [d15])?.key, PeriodKey(.day, day(2026, 9, 14)))
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        let d14 = PeriodKey(.day, day(2026, 9, 14))
        let existing = [d14: fresh(d14, tree, [:])]
        XCTAssertNil(next(entries, existing, excluding: [d15]), "week 38 must not generate without day 15")
    }

    func testOrphansAreDocsWhosePeriodHasNoEntries() {
        let entries = [entry("a", "2026-09-14T10:00:00Z")]
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        let gone = PeriodKey(.day, day(2026, 9, 10))
        let kept = PeriodKey(.day, day(2026, 9, 14))
        let existing = [gone: fresh(gone, tree, [:]), kept: fresh(kept, tree, [:])]
        XCTAssertEqual(PeriodSummaryPlanner.orphans(tree: tree, existing: existing), [gone])
    }

    func testDayInputsAreOldestFirstLabelledAndCarryTheUsersOwnWords() {
        let entries = [
            entry("late", "2026-09-14T18:30:00Z", summary: "You walked by the sea.", content: "  Mira said the sea was breathing.  "),
            entry("early", "2026-09-14T08:05:00Z", summary: nil, content: "  Woke up early to write.  "),
        ]
        let item = next(entries)
        XCTAssertEqual(item?.label, "Mon 14 Sep 2026")
        XCTAssertEqual(item?.children, [
            PeriodSummaryChildInput(id: "early", label: "08:05 · text", text: "Woke up early to write.",
                                    excerpt: "Woke up early to write."),
            PeriodSummaryChildInput(id: "late", label: "18:30 · text", text: "You walked by the sea.",
                                    excerpt: "Mira said the sea was breathing."),
        ])
        XCTAssertEqual(item?.request.periodType, "day")
    }

    func testDayExcerptIsCappedAndOmittedForEmptyContent() {
        let long = String(repeating: "w", count: PeriodSummaryPlanner.excerptMaxChars + 50)
        let entries = [
            entry("a", "2026-09-14T08:00:00Z", summary: "S.", content: long),
            entry("b", "2026-09-14T09:00:00Z", summary: "Only a summary.", content: "   "),
        ]
        let children = next(entries)?.children
        XCTAssertEqual(children?.first?.excerpt?.count, PeriodSummaryPlanner.excerptMaxChars)
        XCTAssertNil(children?.last?.excerpt)
    }

    func testEntriesWithNoTextAreIgnored() {
        XCTAssertNil(next([entry("empty", "2026-09-14T10:00:00Z", summary: nil, content: "   ")]))
    }

    func testDayInputIsCappedToTheMostRecentEntries() {
        let many = (0..<(PeriodSummaryPlanner.maxEntriesPerDay + 5)).map { i in
            entry("e\(i)", String(format: "2026-09-14T10:%02d:00Z", i))
        }
        let item = next(many)
        XCTAssertEqual(item?.children.count, PeriodSummaryPlanner.maxEntriesPerDay)
        XCTAssertEqual(item?.children.first?.label, "10:05 · text")
    }

    func testWeekInputsAreItsDaySummariesInOrder() {
        let entries = [entry("a", "2026-09-15T10:00:00Z"), entry("b", "2026-09-14T10:00:00Z")]
        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: utc)
        var existing: [PeriodKey: PeriodSummary] = [:]
        for d in [day(2026, 9, 14), day(2026, 9, 15)] {
            existing[PeriodKey(.day, d)] = fresh(PeriodKey(.day, d), tree, existing)
        }
        let item = next(entries, existing)
        XCTAssertEqual(item?.key, PeriodKey(.week, 202638))
        XCTAssertEqual(item?.label, "Week of Mon 14 Sep 2026")
        XCTAssertEqual(item?.children.map(\.label), ["Mon 14 Sep 2026", "Tue 15 Sep 2026"])
        let first = item?.children.first
        let d14 = PeriodKey(.day, day(2026, 9, 14))
        XCTAssertEqual(first?.id, d14.docId)
        XCTAssertEqual(first?.text, "Summary \(d14)")
        XCTAssertEqual(first?.salience, 6)
        XCTAssertEqual(first?.anchors, [PeriodSummaryAnchor(entryId: "q-\(d14)", quote: "Quote \(d14)")])
        XCTAssertEqual(first?.threads, ["Thread day"])
        XCTAssertNil(first?.excerpt)
    }

    func testLocalTimezoneDecidesTheDay() {
        let kl = TimeZone(identifier: "Asia/Kuala_Lumpur")!
        let e = entry("a", "2026-09-13T23:30:00Z") // 07:30 on Mon 14 Sep in KL
        let tree = PeriodSummaryPlanner.tree(entries: [e], timeZone: kl)
        XCTAssertNotNil(tree.dayEntries[day(2026, 9, 14)])
        XCTAssertNil(tree.dayEntries[day(2026, 9, 13)])
    }
}
