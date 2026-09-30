import XCTest
@testable import LuminaLog

@MainActor
private final class StubExtractor: UserFactExtracting {
    var requests: [UserFactsRequest] = []
    /// Consumed one per call; running out means `{ops: []}`.
    var outcomes: [Result<[UserFactOperation], Error>] = []
    /// Runs inside the call before it returns: the user acting meanwhile.
    var duringCall: (@MainActor () async -> Void)?

    func extractUserFacts(_ request: UserFactsRequest) async throws -> UserFactsResponse {
        requests.append(request)
        await duringCall?()
        let outcome: Result<[UserFactOperation], Error> = outcomes.isEmpty ? .success([]) : outcomes.removeFirst()
        return UserFactsResponse(ops: try outcome.get(), model: "stub")
    }
}

private struct Boom: Error {}

@MainActor
final class UserFactReconcilerTests: XCTestCase {

    private typealias F = UserFactFixtures
    private var clock = UserFactFixtures.date("2026-09-28T12:00:00Z")
    private var entries: [JournalEntry] = []
    /// Whether `loadEntries()` reports a server-confirmed, complete read. Pruning
    /// trusts only this; extraction runs regardless.
    private var fromServer = true
    private var enabled = true
    private var consent = true
    private var extractor: StubExtractor!
    private var repo: InMemoryUserFactRepository!
    private var nextId = 0

    override func setUp() async throws {
        extractor = StubExtractor()
        repo = InMemoryUserFactRepository()
        nextId = 0
        entries = [F.entry("e1", "2026-09-20T10:00:00Z"), F.entry("e2", "2026-09-21T10:00:00Z")]
    }

    private func make() -> UserFactReconciler {
        UserFactReconciler(
            extractor: extractor,
            repository: repo,
            loadEntries: { [unowned self] in (self.entries, self.fromServer) },
            hasConsent: { [unowned self] in self.consent },
            isEnabled: { [unowned self] in self.enabled },
            timeZone: { TimeZone(identifier: "UTC")! },
            now: { [unowned self] in self.clock },
            makeId: { [unowned self] in self.nextId += 1; return "new-\(self.nextId)" }
        )
    }

    private let addForestCity = UserFactOperation(op: "add", category: "place", subject: "Forest City",
                                                  statement: "You live in Forest City.", evidence: ["e2"])

    func testReadsPendingEntriesAndMarksThemProcessed() async throws {
        extractor.outcomes = [.success([addForestCity])]
        let result = await make().run(budget: 4)
        XCTAssertEqual(result.batches, 1)
        XCTAssertEqual(result.added, 1)
        XCTAssertEqual(extractor.requests.map { $0.entries.map(\.id) }, [["e1", "e2"]])
        let state = try await repo.state()
        XCTAssertEqual(state.processed, ["e1": UserFactPlanner.stamp(entries[0]), "e2": UserFactPlanner.stamp(entries[1])])
        let facts = try await repo.all()
        XCTAssertEqual(facts.map(\.statement), ["You live in Forest City."])
    }

    func testASecondRunWithNothingPendingMakesNoCalls() async {
        let reconciler = make()
        await reconciler.run(budget: 4)
        clock = clock.addingTimeInterval(UserFactReconciler.throttleInterval + 1)
        let result = await reconciler.run(budget: 4)
        XCTAssertEqual(result, .init())
        XCTAssertEqual(extractor.requests.count, 1)
    }

    func testRunsAreThrottledUnlessForced() async {
        let reconciler = make()
        await reconciler.run(budget: 4)
        entries.append(F.entry("e3", "2026-09-22T10:00:00Z"))
        let throttled = await reconciler.run(budget: 4)
        XCTAssertEqual(throttled.skipped, .throttled)
        let forced = await reconciler.run(budget: 4, force: true)
        XCTAssertNil(forced.skipped)
        XCTAssertEqual(forced.batches, 1)
    }

    func testSkipsWhenDisabledWithoutConsentOrPaused() async throws {
        enabled = false
        let disabled = await make().run(budget: 4, force: true)
        XCTAssertEqual(disabled.skipped, .disabled)
        enabled = true
        consent = false
        let noConsent = await make().run(budget: 4, force: true)
        XCTAssertEqual(noConsent.skipped, .noConsent)
        consent = true
        try await repo.saveState(UserFactExtractionState(learning: false))
        let paused = await make().run(budget: 4, force: true)
        XCTAssertEqual(paused.skipped, .paused)
        XCTAssertTrue(extractor.requests.isEmpty)
    }

    func testAnEntryThatKeepsFailingGoesSoloThenIsSkipped() async throws {
        extractor.outcomes = Array(repeating: .failure(Boom()), count: 12)
        let reconciler = make()
        for _ in 0..<4 { await reconciler.run(budget: 4, force: true) }
        XCTAssertEqual(extractor.requests.map { $0.entries.map(\.id) },
                       [["e1", "e2"], ["e1", "e2"], ["e1"], ["e1"], ["e2"], ["e2"]])
        let state = try await repo.state()
        XCTAssertEqual(Set(state.skipped.keys), ["e1", "e2"])
        XCTAssertTrue(state.processed.isEmpty)
    }

    func testTwoConsecutiveFailuresEndTheRun() async {
        extractor.outcomes = [.failure(Boom()), .failure(Boom())]
        let result = await make().run(budget: 4, force: true)
        XCTAssertTrue(result.aborted)
        XCTAssertEqual(result.failed, 2)
    }

    func testNotEntitledBacksOff() async {
        extractor.outcomes = [.failure(ProxyAPIError.httpError(statusCode: 402, body: ""))]
        let reconciler = make()
        let first = await reconciler.run(budget: 4, force: true)
        XCTAssertTrue(first.aborted)
        XCTAssertEqual(first.failed, 0)
        let second = await reconciler.run(budget: 4, force: true)
        XCTAssertEqual(second.skipped, .notEntitled)
        clock = clock.addingTimeInterval(UserFactReconciler.notEntitledBackoff + 1)
        let third = await reconciler.run(budget: 4, force: true)
        XCTAssertNil(third.skipped)
    }

    func testAnEmptyEntryListNeverPrunes() async throws {
        try await repo.save(F.fact("k", evidence: ["e1"]))
        entries = []   // what fetchAllEntries() returns before the key loads
        await make().run(budget: 4, force: true)
        let facts = try await repo.all()
        XCTAssertEqual(facts.map(\.id), ["k"])
    }

    func testPrunesFactsWhoseEntriesWereDeleted() async throws {
        try await repo.save(F.fact("k", evidence: ["gone"]))
        try await repo.saveState(UserFactExtractionState(processed: ["gone": 1]))
        await make().run(budget: 4, force: true)
        let facts = try await repo.all()
        XCTAssertTrue(facts.isEmpty)
        let state = try await repo.state()
        XCTAssertNil(state.processed["gone"])
    }

    /// A cache read (`isFromServer == false`) may be a partial list: pruning
    /// against it would delete facts whose entries simply were not in this page.
    /// Extraction is unaffected, since it only reads what is present.
    func testACacheReadWithAPartialListPrunesNothingButStillExtracts() async throws {
        try await repo.save(F.fact("k", evidence: ["gone"]))
        try await repo.saveState(UserFactExtractionState(processed: ["gone": 1]))
        fromServer = false
        extractor.outcomes = [.success([addForestCity])]
        let result = await make().run(budget: 4, force: true)
        XCTAssertEqual(result.pruned, 0)
        XCTAssertEqual(result.batches, 1)
        XCTAssertEqual(extractor.requests.map { $0.entries.map(\.id) }, [["e1", "e2"]])
        let facts = try await repo.all()
        XCTAssertTrue(facts.contains { $0.id == "k" })
        let state = try await repo.state()
        XCTAssertEqual(state.processed["gone"], 1)
    }

    func testAUserEditMadeDuringTheCallWins() async throws {
        let known = F.fact("fact-1", category: .place, subject: "Kuching", statement: "You live in Kuching.", evidence: ["e1"])
        try await repo.save(known)
        try await repo.saveState(UserFactExtractionState(processed: ["e1": UserFactPlanner.stamp(entries[0])]))
        extractor.outcomes = [.success([UserFactOperation(op: "update", ref: "f1",
                                                          statement: "You live in central Kuching.", evidence: ["e2"])])]
        extractor.duringCall = { [unowned self] in
            var edited = known
            edited.statement = "You live in Kuching, Sarawak."
            edited.userAuthored = true
            try? await self.repo.save(edited)
        }
        await make().run(budget: 4, force: true)
        let saved = try await repo.all().first { $0.id == "fact-1" }
        XCTAssertEqual(saved?.statement, "You live in Kuching, Sarawak.")
        XCTAssertEqual(saved?.proposal?.statement, "You live in central Kuching.")
    }

    func testForgetEverythingDuringTheCallWins() async throws {
        extractor.outcomes = [.success([addForestCity])]
        extractor.duringCall = { [unowned self] in
            try? await self.repo.deleteAll()
            try? await self.repo.saveState(UserFactExtractionState(learning: false))
        }
        let result = await make().run(budget: 4, force: true)
        XCTAssertEqual(result.skipped, .paused)
        let facts = try await repo.all()
        XCTAssertTrue(facts.isEmpty)
        let state = try await repo.state()
        XCTAssertFalse(state.learning)
        XCTAssertTrue(state.processed.isEmpty)
    }
}
