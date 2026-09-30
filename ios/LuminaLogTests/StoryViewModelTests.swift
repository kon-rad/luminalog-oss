import XCTest
@testable import LuminaLog

@MainActor
final class StoryViewModelTests: XCTestCase {

    private let utc = TimeZone(identifier: "UTC")!
    private struct Boom: Error {}

    private func at(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    private func entry(_ id: String, _ iso: String) -> JournalEntry {
        JournalEntry(id: id, userId: "u", type: .text, title: id, createdAt: at(iso), updatedAt: at(iso),
                     content: "Body", summary: AIGeneration(text: "Entry \(id)", generatedAt: at(iso)))
    }

    private let october = PeriodKey(.month, 2026 * 12 + 9)

    private func monthSummary() -> PeriodSummary {
        PeriodSummary(key: october, title: "The move", sentence: "You moved.", summary: "You moved house.",
                      generatedAt: at("2026-10-02T08:00:00Z"), sourceCount: 1, sourceFingerprint: "f",
                      isOpen: true, model: "m", promptVersion: 1)
    }

    // Mutable fakes the closures read.
    private var entries: [JournalEntry] = []
    private var entriesError: Error?
    private var summaries: [PeriodSummary] = []
    private var summariesError: Error?
    private var summaryReads = 0
    private var reconcileCalls = 0
    private var generatedOnReconcile = 0
    private var summariesAfterReconcile: [PeriodSummary]?
    private var consent = true

    override func setUp() {
        entries = [entry("e1", "2026-09-29T08:00:00Z"), entry("e2", "2026-10-01T07:00:00Z")]
        entriesError = nil
        summaries = []
        summariesError = nil
        summaryReads = 0
        reconcileCalls = 0
        generatedOnReconcile = 0
        summariesAfterReconcile = nil
        consent = true
    }

    private func makeViewModel(focus: PeriodKey? = nil) -> StoryViewModel {
        StoryViewModel(
            loadEntries: { [self] in
                if let entriesError { throw entriesError }
                return entries
            },
            loadSummaries: { [self] in
                summaryReads += 1
                if let summariesError { throw summariesError }
                return summaries
            },
            timeZone: { [self] in utc },
            reconcile: { [self] in
                reconcileCalls += 1
                if let next = summariesAfterReconcile { summaries = next }
                return generatedOnReconcile
            },
            hasConsent: { [self] in consent },
            now: { [self] in at("2026-10-02T09:00:00Z") },
            focus: focus
        )
    }

    func testLoadBuildsTheOutlineOpenOnNow() async {
        let vm = makeViewModel()
        await vm.load()
        XCTAssertEqual(vm.state, .loaded)
        XCTAssertTrue(vm.expanded.contains(october.docId))
        XCTAssertEqual(vm.rows.first?.id, "all_0")
        XCTAssertTrue(vm.rows.contains { $0.id == october.docId })
        XCTAssertTrue(vm.awaitingSummaries)
        XCTAssertNil(vm.scrollTarget)
    }

    func testFocusStartsFromThePathToThePeriodAndSetsTheScrollTarget() async {
        // e1 is Tue 29 Sep, e2 Thu 1 Oct: week 40 straddles, and its Thursday is in October.
        let week40 = PeriodKey(.week, 202640)
        let listing = "\(week40.docId)@\(october.docId)"
        let vm = makeViewModel(focus: week40)
        await vm.load()
        XCTAssertEqual(vm.expanded, ["all_0", "year_2026", "quarter_\(2026 * 4 + 3)", october.docId, listing])
        XCTAssertEqual(vm.scrollTarget, listing)
        XCTAssertTrue(vm.rows.contains { $0.id == "day_\(PeriodSummaryIndex.localDayIndex(for: at("2026-10-01T07:00:00Z"), in: utc))" })
        // A rebuild after the reconciler keeps the focus expansion and doesn't re-scroll.
        vm.toggle(listing)
        generatedOnReconcile = 1
        summariesAfterReconcile = [monthSummary()]
        await vm.reconcileAndReload()
        XCTAssertFalse(vm.expanded.contains(listing))
        XCTAssertEqual(vm.scrollTarget, listing)
    }

    func testFocusOutsideTheOutlineFallsBackToNow() async {
        let vm = makeViewModel(focus: PeriodKey(.month, 2026 * 12 + 5))   // June: no entries
        await vm.load()
        XCTAssertEqual(vm.expanded, ["all_0", "year_2026", "quarter_\(2026 * 4 + 3)", october.docId])
        XCTAssertNil(vm.scrollTarget)
    }

    func testNoEntriesIsEmpty() async {
        entries = []
        let vm = makeViewModel()
        await vm.load()
        XCTAssertEqual(vm.state, .empty)
        XCTAssertTrue(vm.rows.isEmpty)
    }

    func testEntriesFailureIsFailed() async {
        entriesError = Boom()
        let vm = makeViewModel()
        await vm.load()
        XCTAssertEqual(vm.state, .failed)
    }

    func testSummaryReadFailureStillShowsTheOutline() async {
        summariesError = Boom()
        let vm = makeViewModel()
        await vm.load()
        XCTAssertEqual(vm.state, .loaded)
        XCTAssertNil(vm.rows.first { $0.id == october.docId }?.node.title)
        XCTAssertTrue(vm.awaitingSummaries)
    }

    func testSummariesAreOverlaid() async {
        summaries = [monthSummary()]
        let vm = makeViewModel()
        await vm.load()
        XCTAssertEqual(vm.rows.first { $0.id == october.docId }?.node.title, "The move")
        XCTAssertFalse(vm.awaitingSummaries)
    }

    func testToggleShowsAndHidesChildren() async {
        let vm = makeViewModel()
        await vm.load()
        let before = vm.rows.count
        vm.toggle(october.docId)
        XCTAssertFalse(vm.expanded.contains(october.docId))
        XCTAssertLessThan(vm.rows.count, before)
        vm.toggle(october.docId)
        XCTAssertEqual(vm.rows.count, before)
    }

    func testReconcileRebuildKeepsTheUsersExpansion() async {
        let vm = makeViewModel()
        await vm.load()
        vm.toggle(october.docId)                       // user collapses October
        generatedOnReconcile = 1
        summariesAfterReconcile = [monthSummary()]
        await vm.reconcileAndReload()
        XCTAssertFalse(vm.expanded.contains(october.docId))
        XCTAssertEqual(vm.rows.first { $0.id == october.docId }?.node.title, "The move")
    }

    func testNothingGeneratedMeansNoSecondRead() async {
        let vm = makeViewModel()
        await vm.start()
        XCTAssertEqual(reconcileCalls, 1)
        XCTAssertEqual(summaryReads, 1)
    }

    func testStartRunsOnceForTheScreen() async {
        let vm = makeViewModel()
        await vm.start()
        await vm.start()
        XCTAssertEqual(reconcileCalls, 1)
    }

    func testConsentOffSkipsTheReconciler() async {
        consent = false
        let vm = makeViewModel()
        await vm.start()
        XCTAssertTrue(vm.consentOff)
        XCTAssertEqual(reconcileCalls, 0)
        XCTAssertEqual(vm.state, .loaded)
    }

    func testFailedStartDoesNotReconcile() async {
        entriesError = Boom()
        let vm = makeViewModel()
        await vm.start()
        XCTAssertEqual(reconcileCalls, 0)
    }
}
