import XCTest
@testable import LuminaLog

@MainActor
private final class StubGenerator: PeriodSummaryGenerating {
    var requests: [PeriodSummaryRequest] = []
    /// Consumed one per call; nil (or running out) means success.
    var outcomes: [Error?] = []

    func generatePeriodSummary(_ request: PeriodSummaryRequest) async throws -> GeneratedPeriodSummary {
        requests.append(request)
        if !outcomes.isEmpty, let error = outcomes.removeFirst() { throw error }
        return GeneratedPeriodSummary(title: "T: \(request.periodLabel)", sentence: "S: \(request.periodLabel)", summary: "Summary: \(request.periodLabel)",
                                      salience: 5, anchors: [], keyScenes: .none, threads: ["stub thread"], model: "stub")
    }
}

private struct Boom: Error {}

@MainActor
final class PeriodSummaryReconcilerTests: XCTestCase {

    private let utc = TimeZone(identifier: "UTC")!
    private var clock = ISO8601DateFormatter().date(from: "2026-09-26T12:00:00Z")!
    private var entries: [JournalEntry] = []
    private var enabled = true
    private var consent = true
    private var timeZoneCalls = 0
    private var generator: StubGenerator!
    private var repo: InMemoryPeriodSummaryRepository!

    override func setUp() async throws {
        generator = StubGenerator()
        repo = InMemoryPeriodSummaryRepository()
        entries = [
            entry("a", "2026-09-14T10:00:00Z"),
            entry("b", "2026-09-15T10:00:00Z"),
        ]
    }

    private func entry(_ id: String, _ iso: String) -> JournalEntry {
        let date = ISO8601DateFormatter().date(from: iso)!
        return JournalEntry(id: id, userId: "u", type: .text, title: id, createdAt: date, updatedAt: date,
                            content: "Body", summary: AIGeneration(text: "Entry \(id)", generatedAt: date))
    }

    private func makeReconciler() -> PeriodSummaryReconciler {
        PeriodSummaryReconciler(
            generator: generator,
            repository: repo,
            loadEntries: { [unowned self] in self.entries },
            timeZone: { [unowned self] in self.timeZoneCalls += 1; return self.utc },
            hasConsent: { [unowned self] in self.consent },
            isEnabled: { [unowned self] in self.enabled },
            now: { [unowned self] in
                // Advance one second per read so every generatedAt is distinct.
                self.clock = self.clock.addingTimeInterval(1)
                return self.clock
            }
        )
    }

    func testBackfillsBottomUpNewestFirst() async {
        let result = await makeReconciler().run(budget: 20, includeOpen: false)
        XCTAssertEqual(generator.requests.map(\.periodLabel),
                       ["Tue 15 Sep 2026", "Mon 14 Sep 2026", "Week of Mon 14 Sep 2026"])
        XCTAssertEqual(result.generated, 3)
        XCTAssertEqual(repo.store.count, 3)
        XCTAssertEqual(repo.store[PeriodKey(.week, 202638)]?.sourceCount, 2)
        XCTAssertEqual(repo.store[PeriodKey(.week, 202638)]?.promptVersion, PeriodSummaryPlanner.promptVersion)
        XCTAssertEqual(repo.store[PeriodKey(.week, 202638)]?.details.threads, ["stub thread"])
        // The week's request carried each day's details up the tree.
        XCTAssertEqual(generator.requests.last?.children.map(\.threads), [["stub thread"], ["stub thread"]])
        XCTAssertEqual(generator.requests.last?.children.map(\.salience), [5, 5])
    }

    func testBudgetStopsTheRun() async {
        let result = await makeReconciler().run(budget: 1, includeOpen: false)
        XCTAssertEqual(result.generated, 1)
        XCTAssertEqual(generator.requests.count, 1)
    }

    func testASecondRunWithNothingStaleMakesNoCalls() async {
        let reconciler = makeReconciler()
        await reconciler.run(budget: 20, includeOpen: false)
        clock = clock.addingTimeInterval(PeriodSummaryReconciler.throttleInterval + 1)
        generator.requests = []
        let result = await reconciler.run(budget: 20, includeOpen: false)
        XCTAssertEqual(result, .init())
        XCTAssertTrue(generator.requests.isEmpty)
    }

    func testClosedRunsAreThrottledButOpenRunsAreNot() async {
        let reconciler = makeReconciler()
        await reconciler.run(budget: 1, includeOpen: false)
        let throttled = await reconciler.run(budget: 20, includeOpen: false)
        XCTAssertEqual(throttled.skipped, .throttled)
        let open = await reconciler.run(budget: 20, includeOpen: true)
        XCTAssertNil(open.skipped)
        XCTAssertGreaterThan(open.generated, 0)
    }

    func testAbortsAfterThreeConsecutiveFailures() async {
        entries = (10...16).map { entry("e\($0)", "2026-09-\($0)T10:00:00Z") }
        generator.outcomes = [Boom(), Boom(), Boom()]
        let result = await makeReconciler().run(budget: 20, includeOpen: false)
        XCTAssertTrue(result.aborted)
        XCTAssertEqual(result.failed, 3)
        XCTAssertEqual(result.generated, 0)
        XCTAssertEqual(generator.requests.count, 3)
    }

    func testFailedPeriodIsSkippedAndItsParentWaits() async {
        generator.outcomes = [Boom()]
        let result = await makeReconciler().run(budget: 20, includeOpen: false)
        XCTAssertEqual(generator.requests.map(\.periodLabel), ["Tue 15 Sep 2026", "Mon 14 Sep 2026"])
        XCTAssertEqual(result.failed, 1)
        XCTAssertEqual(result.generated, 1)
        XCTAssertNil(repo.store[PeriodKey(.week, 202638)])
    }

    func testSaveFailureCountsAsAFailure() async {
        repo.saveError = Boom()
        let result = await makeReconciler().run(budget: 20, includeOpen: false)
        XCTAssertEqual(result.generated, 0)
        XCTAssertEqual(result.failed, 2)
    }

    func testNotEntitledAbortsAndBacksOff() async {
        generator.outcomes = [ProxyAPIError.httpError(statusCode: 402, body: "")]
        let reconciler = makeReconciler()
        let first = await reconciler.run(budget: 20, includeOpen: false)
        XCTAssertTrue(first.aborted)
        XCTAssertEqual(generator.requests.count, 1)
        clock = clock.addingTimeInterval(PeriodSummaryReconciler.throttleInterval + 1)
        let second = await reconciler.run(budget: 20, includeOpen: true)
        XCTAssertEqual(second.skipped, .notEntitled)
    }

    func testDisabledOrNoConsentDoesNothing() async {
        enabled = false
        let off = await makeReconciler().run(budget: 20, includeOpen: true)
        XCTAssertEqual(off.skipped, .disabled)
        enabled = true
        consent = false
        let noConsent = await makeReconciler().run(budget: 20, includeOpen: true)
        XCTAssertEqual(noConsent.skipped, .noConsent)
        XCTAssertTrue(generator.requests.isEmpty)
    }

    func testDeletesOrphansAndRegeneratesTheParent() async {
        let reconciler = makeReconciler()
        await reconciler.run(budget: 20, includeOpen: false)
        entries.removeAll { $0.id == "b" } // every entry of 15 Sep deleted
        clock = clock.addingTimeInterval(PeriodSummaryReconciler.throttleInterval + 1)
        generator.requests = []
        let result = await reconciler.run(budget: 20, includeOpen: false)
        XCTAssertEqual(result.deleted, 1)
        XCTAssertEqual(repo.deleted, [PeriodKey(.day, 20_711)]) // 15 Sep 2026
        XCTAssertEqual(generator.requests.map(\.periodLabel), ["Week of Mon 14 Sep 2026"])
    }

    func testConcurrentRunsJoinInsteadOfDoubling() async {
        let reconciler = makeReconciler()
        async let a = reconciler.run(budget: 20, includeOpen: false)
        async let b = reconciler.run(budget: 20, includeOpen: false)
        let (ra, rb) = await (a, b)
        XCTAssertEqual(generator.requests.count, 3)
        XCTAssertEqual(ra, rb)
    }

    func testTimeZoneProviderIsAwaitedOncePerRun() async {
        await makeReconciler().run(budget: 20, includeOpen: false)
        XCTAssertEqual(timeZoneCalls, 1)
    }
}
