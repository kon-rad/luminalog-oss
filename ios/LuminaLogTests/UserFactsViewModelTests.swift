import XCTest
@testable import LuminaLog

@MainActor
final class UserFactsViewModelTests: XCTestCase {

    private typealias F = UserFactFixtures
    private let clock = UserFactFixtures.date("2026-09-28T12:00:00Z")
    private let utc = TimeZone(identifier: "UTC")!
    private var repo: InMemoryUserFactRepository!
    private var entries: [JournalEntry] = []
    private var reconcileCalls = 0
    private var reconcileWork: (@MainActor () async -> Int) = { 0 }

    override func setUp() async throws {
        repo = InMemoryUserFactRepository()
        entries = [F.entry("e1", "2026-09-20T10:00:00Z"), F.entry("e2", "2026-09-21T10:00:00Z"), F.entry("e3", "2026-09-22T10:00:00Z")]
        reconcileCalls = 0
        reconcileWork = { 0 }
    }

    private func make(consent: Bool = true) -> UserFactsViewModel {
        UserFactsViewModel(
            repository: repo,
            loadEntries: { [unowned self] in self.entries },
            hasConsent: { consent },
            reconcile: { [unowned self] in self.reconcileCalls += 1; return await self.reconcileWork() },
            now: { [unowned self] in self.clock },
            makeId: { "made" }
        )
    }

    func testLoadBuildsSectionsProposalsAndHistory() async throws {
        let proposal = UserFactProposal(kind: .update, statement: "New.", validTo: nil, reason: nil, evidence: ["e1"])
        for fact in [
            F.fact("p1", category: .person, lastConfirmed: "2026-09-01T10:00:00Z"),
            F.fact("p2", category: .person, lastConfirmed: "2026-09-10T10:00:00Z", proposal: proposal),
            F.fact("g1", category: .goal),
            F.fact("old", category: .place, status: .invalidated),
            F.fact("tomb", category: .value, status: .rejected),
        ] { try await repo.save(fact) }
        let vm = make()
        await vm.load()
        XCTAssertEqual(vm.loadState, .loaded)
        XCTAssertEqual(vm.sections.map(\.category), [.person, .goal])
        XCTAssertEqual(vm.sections[0].facts.map(\.id), ["p2", "p1"])
        XCTAssertEqual(vm.proposals.map(\.id), ["p2"])
        XCTAssertEqual(vm.history.map(\.id), ["old"])
        XCTAssertFalse(vm.isEmpty)
    }

    func testProgressCountsReadEntriesUntilAllAreRead() async throws {
        try await repo.saveState(UserFactExtractionState(processed: ["e1": 1]))
        let vm = make()
        await vm.load()
        XCTAssertEqual(vm.progress, .init(read: 1, total: 3))
        try await repo.saveState(UserFactExtractionState(processed: ["e1": 1, "e2": 1, "e3": 1]))
        await vm.load()
        XCTAssertNil(vm.progress)
    }

    func testStartReconcilesAndReloadsWhenSomethingWasRead() async throws {
        reconcileWork = { [unowned self] in
            try? await self.repo.save(F.fact("fresh"))
            return 1
        }
        let vm = make()
        await vm.start()
        XCTAssertEqual(reconcileCalls, 1)
        XCTAssertEqual(vm.facts.map(\.id), ["fresh"])
    }

    func testStartDoesNotReconcileWithoutConsentOrWhenPaused() async throws {
        await make(consent: false).start()
        try await repo.saveState(UserFactExtractionState(learning: false))
        await make().start()
        XCTAssertEqual(reconcileCalls, 0)
    }

    func testAddCreatesAUserAuthoredFact() async throws {
        let vm = make()
        await vm.add(category: .goal, subject: " Marathon ", statement: " You are training for a marathon. ", validFrom: nil)
        let fact = try XCTUnwrap(repo.store["made"])
        XCTAssertEqual(fact.subject, "Marathon")
        XCTAssertEqual(fact.statement, "You are training for a marathon.")
        XCTAssertEqual(fact.origin, .user)
        XCTAssertTrue(fact.userAuthored)
        XCTAssertEqual(fact.evidence, [])
        XCTAssertEqual(vm.facts.map(\.id), ["made"])
    }

    func testEditMarksUserAuthoredAndClearsTheProposal() async throws {
        let proposal = UserFactProposal(kind: .update, statement: "X", validTo: nil, reason: nil, evidence: ["e1"])
        try await repo.save(F.fact("k", proposal: proposal))
        let vm = make()
        await vm.load()
        await vm.edit(vm.facts[0], category: .person, subject: "Maya", statement: "Maya is my twin.", validFrom: nil)
        let fact = try XCTUnwrap(repo.store["k"])
        XCTAssertEqual(fact.statement, "Maya is my twin.")
        XCTAssertTrue(fact.userAuthored)
        XCTAssertNil(fact.proposal)
        XCTAssertEqual(fact.origin, .extracted, "editing does not change where it came from")
    }

    func testMarkNotTrueClampsToValidFrom() async throws {
        try await repo.save(F.fact("k", validFrom: "2026-03-02T10:00:00Z"))
        let vm = make()
        await vm.load()
        await vm.markNotTrue(vm.facts[0], endedOn: F.date("2026-01-01T10:00:00Z"))
        let fact = try XCTUnwrap(repo.store["k"])
        XCTAssertEqual(fact.status, .invalidated)
        XCTAssertEqual(fact.validTo, F.date("2026-03-02T10:00:00Z"))
        XCTAssertTrue(fact.userAuthored)
    }

    func testRestoreMakesAnEndedFactTrueAgain() async throws {
        var ended = F.fact("k", status: .invalidated)
        ended.validTo = F.date("2026-06-01T10:00:00Z")
        ended.supersededBy = "other"
        try await repo.save(ended)
        let vm = make()
        await vm.load()
        await vm.restore(vm.facts[0])
        let fact = try XCTUnwrap(repo.store["k"])
        XCTAssertEqual(fact.status, .active)
        XCTAssertNil(fact.validTo)
        XCTAssertNil(fact.supersededBy)
        XCTAssertTrue(fact.userAuthored)
    }

    func testDeleteLeavesATombstoneThatNoListShows() async throws {
        try await repo.save(F.fact("k"))
        let vm = make()
        await vm.load()
        await vm.delete(vm.facts[0])
        XCTAssertEqual(repo.store["k"]?.status, .rejected)
        XCTAssertTrue(vm.sections.isEmpty)
        XCTAssertTrue(vm.history.isEmpty)
        XCTAssertTrue(vm.isEmpty)
    }

    func testAcceptingProposals() async throws {
        try await repo.save(F.fact("u", statement: "Old.", userAuthored: true,
                                   proposal: .init(kind: .update, statement: "New.", validTo: nil, reason: nil, evidence: ["e2"])))
        try await repo.save(F.fact("i", userAuthored: true,
                                   proposal: .init(kind: .invalidate, statement: nil, validTo: F.date("2026-09-21T10:00:00Z"),
                                                   reason: "You moved.", evidence: ["e2"])))
        let vm = make()
        await vm.load()
        let update = try XCTUnwrap(vm.fact(id: "u"))
        await vm.acceptProposal(update)
        let invalidate = try XCTUnwrap(vm.fact(id: "i"))
        await vm.acceptProposal(invalidate)
        XCTAssertEqual(repo.store["u"]?.statement, "New.")
        XCTAssertEqual(repo.store["u"]?.evidence, ["e0", "e2"])
        XCTAssertNil(repo.store["u"]?.proposal)
        XCTAssertEqual(repo.store["i"]?.status, .invalidated)
        XCTAssertEqual(repo.store["i"]?.validTo, F.date("2026-09-21T10:00:00Z"))
    }

    func testDismissingAProposalKeepsTheFact() async throws {
        try await repo.save(F.fact("u", statement: "Old.", userAuthored: true,
                                   proposal: .init(kind: .update, statement: "New.", validTo: nil, reason: nil, evidence: ["e2"])))
        let vm = make()
        await vm.load()
        await vm.dismissProposal(vm.facts[0])
        XCTAssertEqual(repo.store["u"]?.statement, "Old.")
        XCTAssertNil(repo.store["u"]?.proposal)
    }

    func testForgetEverythingDeletesAllAndStopsLearning() async throws {
        try await repo.save(F.fact("a"))
        try await repo.save(F.fact("tomb", status: .rejected))
        try await repo.saveState(UserFactExtractionState(processed: ["e1": 1]))
        let vm = make()
        await vm.load()
        await vm.forgetEverything()
        XCTAssertTrue(repo.store.isEmpty)
        let state = try await repo.state()
        XCTAssertFalse(state.learning)
        XCTAssertTrue(state.processed.isEmpty)
        XCTAssertFalse(vm.learning)
    }

    func testSetLearningPersists() async throws {
        let vm = make()
        await vm.setLearning(false)
        let state = try await repo.state()
        XCTAssertFalse(state.learning)
        XCTAssertFalse(vm.learning)
    }

    func testSourcesAreNewestFirstAndMarkDeletedEntries() async throws {
        try await repo.save(F.fact("k", evidence: ["e1", "gone", "e2"]))
        let vm = make()
        await vm.load()
        let sources = vm.sources(for: vm.facts[0])
        XCTAssertEqual(sources.map(\.id), ["e2", "gone", "e1"])
        XCTAssertEqual(sources[0].title, "Title e2")
        XCTAssertFalse(sources[1].exists)
    }

    func testCaptionAndSpanFormatting() {
        let extracted = F.fact("k", lastConfirmed: "2026-09-12T10:00:00Z")
        XCTAssertEqual(UserFactFormat.caption(for: extracted, timeZone: utc), "Since Mar 2026 · last mentioned 12 Sep 2026")
        XCTAssertEqual(UserFactFormat.caption(for: F.fact("m", userAuthored: true), timeZone: utc), "Added by you")
        var edited = F.fact("e", userAuthored: false)
        edited.userAuthored = true
        XCTAssertEqual(UserFactFormat.caption(for: edited, timeZone: utc), "Edited by you")

        var ended = F.fact("x")
        ended.validTo = F.date("2026-06-15T10:00:00Z")
        XCTAssertEqual(UserFactFormat.span(for: ended, timeZone: utc), "Mar to Jun 2026")
        ended.validTo = F.date("2027-02-01T10:00:00Z")
        XCTAssertEqual(UserFactFormat.span(for: ended, timeZone: utc), "Mar 2026 to Feb 2027")
        ended.validFrom = nil
        XCTAssertEqual(UserFactFormat.span(for: ended, timeZone: utc), "Until Feb 2027")
    }
}
