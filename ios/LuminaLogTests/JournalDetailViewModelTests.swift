import XCTest
@testable import LuminaLog

final class JournalDetailViewModelTests: XCTestCase {

    // MARK: - Spy AI service

    /// Counts calls and supports a controllable delay + failure injection so
    /// in-flight guards and failure states are testable.
    @MainActor
    private final class SpyAIService: AIService {

        struct SpyError: Error {}

        var summaryCalls = 0
        var insightsCalls = 0
        var promptsCalls = 0

        var delayNanos: UInt64 = 0
        var shouldFail = false

        func generateSummary(journalId: String) async throws -> AIGeneration {
            summaryCalls += 1
            try await waitAndMaybeFail()
            return AIGeneration(text: "spy summary", model: "spy")
        }

        func generateInsights(journalId: String) async throws -> AIGeneration {
            insightsCalls += 1
            try await waitAndMaybeFail()
            return AIGeneration(text: "spy insights", model: "spy")
        }

        func generatePrompts(journalId: String) async throws -> [String] {
            promptsCalls += 1
            try await waitAndMaybeFail()
            return (1...5).map { "Spy prompt \($0)" }
        }

        func dailyPrompt() async throws -> String { "spy daily prompt" }

        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }

        func requestIndex(journalId: String) async {}

        private func waitAndMaybeFail() async throws {
            if delayNanos > 0 {
                try await Task.sleep(nanoseconds: delayNanos)
            }
            if shouldFail {
                throw SpyError()
            }
        }
    }

    // MARK: - Helpers

    @MainActor
    private func makeEntry(
        id: String = "entry-1",
        summary: AIGeneration? = nil,
        insights: AIGeneration? = nil,
        prompts: AIPrompts? = nil,
        contentEditedAt: Date? = nil
    ) -> JournalEntry {
        JournalEntry(
            id: id,
            userId: MockData.userId,
            type: .text,
            title: "Test entry",
            content: "Some journal content worth summarizing.",
            contentEditedAt: contentEditedAt,
            summary: summary,
            insights: insights,
            prompts: prompts
        )
    }

    @MainActor
    private func storedEntry(id: String, in repo: MockJournalRepository) async throws -> JournalEntry? {
        try await repo.entries(after: nil, limit: 100).first { $0.id == id }
    }

    // MARK: - Summary auto-generation

    @MainActor
    func testSummaryAutoGeneratesWhenNilAndPersists() async throws {
        let repo = MockJournalRepository(entries: [makeEntry()])
        let ai = SpyAIService()

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        XCTAssertEqual(ai.summaryCalls, 1, "A nil summary triggers exactly one lazy generation")
        XCTAssertEqual(viewModel.entry?.summary?.text, "spy summary")
        XCTAssertEqual(viewModel.summaryState, .idle)

        // Persisted to the repository, not just held in memory.
        let saved = try await storedEntry(id: "entry-1", in: repo)
        XCTAssertEqual(saved?.summary?.text, "spy summary")

        // A second view model for the same entry must NOT regenerate.
        let second = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await second.start()
        XCTAssertEqual(ai.summaryCalls, 1, "Persisted summary suppresses re-generation on revisit")
        XCTAssertEqual(second.entry?.summary?.text, "spy summary")
    }

    @MainActor
    func testSummaryDoesNotAutoGenerateWhenPresent() async {
        let entry = makeEntry(summary: AIGeneration(text: "existing", model: "m"))
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        XCTAssertEqual(ai.summaryCalls, 0)
        XCTAssertEqual(viewModel.entry?.summary?.text, "existing")
    }

    @MainActor
    func testSummaryAutoGenerationFailureSetsFailedStateWithoutBlockingEntry() async {
        let repo = MockJournalRepository(entries: [makeEntry()])
        let ai = SpyAIService()
        ai.shouldFail = true

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        XCTAssertEqual(viewModel.summaryState, .failed)
        XCTAssertNotNil(viewModel.entry, "Failure never blocks the entry content")
        XCTAssertNil(viewModel.entry?.summary)

        // Retry succeeds and clears the failed state.
        ai.shouldFail = false
        await viewModel.generateSummary()
        XCTAssertEqual(viewModel.summaryState, .idle)
        XCTAssertEqual(viewModel.entry?.summary?.text, "spy summary")
    }

    // MARK: - Regenerate visibility rule

    @MainActor
    func testSummaryStaleOnlyWhenEditedAfterGeneration() async {
        let generatedAt = Date(timeIntervalSinceNow: -3_600)
        let summary = AIGeneration(text: "s", generatedAt: generatedAt, model: "m")

        // Never edited → not stale.
        let untouched = MockJournalRepository(entries: [makeEntry(summary: summary)])
        let vm1 = JournalDetailViewModel(entryId: "entry-1", journals: untouched, ai: SpyAIService())
        await vm1.start()
        XCTAssertFalse(vm1.isSummaryStale)

        // Edited before the summary was generated → not stale.
        let editedBefore = MockJournalRepository(entries: [
            makeEntry(summary: summary, contentEditedAt: generatedAt.addingTimeInterval(-600))
        ])
        let vm2 = JournalDetailViewModel(entryId: "entry-1", journals: editedBefore, ai: SpyAIService())
        await vm2.start()
        XCTAssertFalse(vm2.isSummaryStale)

        // Edited after the summary was generated → stale, shows Regenerate.
        let editedAfter = MockJournalRepository(entries: [
            makeEntry(summary: summary, contentEditedAt: generatedAt.addingTimeInterval(600))
        ])
        let vm3 = JournalDetailViewModel(entryId: "entry-1", journals: editedAfter, ai: SpyAIService())
        await vm3.start()
        XCTAssertTrue(vm3.isSummaryStale)
    }

    // MARK: - Insights

    @MainActor
    func testInsightsGeneratePersistsAndSurvivesReopen() async throws {
        let entry = makeEntry(summary: AIGeneration(text: "s", model: "m"))
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()
        XCTAssertNil(viewModel.entry?.insights)

        await viewModel.generateInsights()
        XCTAssertEqual(ai.insightsCalls, 1)
        XCTAssertEqual(viewModel.entry?.insights?.text, "spy insights")
        XCTAssertEqual(viewModel.insightsState, .idle)

        let saved = try await storedEntry(id: "entry-1", in: repo)
        XCTAssertEqual(saved?.insights?.text, "spy insights")

        // Re-open: a fresh view model sees the saved insights directly.
        let reopened = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await reopened.start()
        XCTAssertEqual(reopened.entry?.insights?.text, "spy insights")
        XCTAssertEqual(ai.insightsCalls, 1, "Insights are never auto-generated")
    }

    @MainActor
    func testInsightsFailureSetsFailedState() async {
        let entry = makeEntry(summary: AIGeneration(text: "s", model: "m"))
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()
        ai.shouldFail = true

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()
        await viewModel.generateInsights()

        XCTAssertEqual(viewModel.insightsState, .failed)
        XCTAssertNil(viewModel.entry?.insights)
    }

    // MARK: - Prompts

    @MainActor
    func testPromptsGeneratePersistsFive() async throws {
        let entry = makeEntry(summary: AIGeneration(text: "s", model: "m"))
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        await viewModel.generatePrompts()
        XCTAssertEqual(ai.promptsCalls, 1)
        XCTAssertEqual(viewModel.entry?.prompts?.items.count, 5)
        XCTAssertEqual(viewModel.promptsState, .idle)

        let saved = try await storedEntry(id: "entry-1", in: repo)
        XCTAssertEqual(saved?.prompts?.items.count, 5)
        XCTAssertEqual(saved?.prompts?.items.first, "Spy prompt 1")
    }

    // MARK: - In-flight guards

    @MainActor
    func testDoubleTapGeneratesInsightsOnce() async {
        let entry = makeEntry(summary: AIGeneration(text: "s", model: "m"))
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()
        ai.delayNanos = 100_000_000

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        async let first: Void = viewModel.generateInsights()
        async let second: Void = viewModel.generateInsights()
        _ = await (first, second)

        XCTAssertEqual(ai.insightsCalls, 1, "The loading guard allows exactly one in-flight generation")
        XCTAssertEqual(viewModel.entry?.insights?.text, "spy insights")
    }

    @MainActor
    func testDoubleTapGeneratesPromptsOnce() async {
        let entry = makeEntry(summary: AIGeneration(text: "s", model: "m"))
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()
        ai.delayNanos = 100_000_000

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        async let first: Void = viewModel.generatePrompts()
        async let second: Void = viewModel.generatePrompts()
        _ = await (first, second)

        XCTAssertEqual(ai.promptsCalls, 1)
        XCTAssertEqual(viewModel.entry?.prompts?.items.count, 5)
    }

    @MainActor
    func testDoubleTapRegeneratesSummaryOnce() async {
        let entry = makeEntry(summary: AIGeneration(text: "old", model: "m"))
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()
        ai.delayNanos = 100_000_000

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()
        XCTAssertEqual(ai.summaryCalls, 0)

        async let first: Void = viewModel.generateSummary()
        async let second: Void = viewModel.generateSummary()
        _ = await (first, second)

        XCTAssertEqual(ai.summaryCalls, 1)
        XCTAssertEqual(viewModel.entry?.summary?.text, "spy summary")
    }

    // MARK: - Deletion safety

    @MainActor
    func testDeleteMidGenerationDoesNotResurrectEntry() async throws {
        let entry = makeEntry(summary: AIGeneration(text: "s", model: "m"))
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()
        ai.delayNanos = 100_000_000

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        // Delete the entry while the generation is still in flight.
        async let generation: Void = viewModel.generateInsights()
        try await Task.sleep(nanoseconds: 30_000_000)
        try await repo.delete(id: "entry-1")
        await generation

        let stored = try await storedEntry(id: "entry-1", in: repo)
        XCTAssertNil(stored, "Persisting an AI field must never recreate a deleted entry")
        XCTAssertEqual(viewModel.insightsState, .idle, "Not-found persistence is a silent no-op")
    }

    @MainActor
    func testMissingEntryDoesNotAutoGenerateSummary() async {
        let repo = MockJournalRepository(entries: [])
        let ai = SpyAIService()

        let viewModel = JournalDetailViewModel(entryId: "missing", journals: repo, ai: ai)
        await viewModel.start()

        XCTAssertTrue(viewModel.hasLoaded)
        XCTAssertNil(viewModel.entry)
        XCTAssertEqual(ai.summaryCalls, 0, "A nil stream emission must not trigger summary generation")
        XCTAssertEqual(viewModel.summaryState, .idle)
    }

    // MARK: - Live updates

    @MainActor
    func testEntryStreamUpdatesLive() async throws {
        let repo = MockJournalRepository(entries: [makeEntry(summary: AIGeneration(text: "s", model: "m"))])
        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: SpyAIService())
        await viewModel.start()

        var updated = try XCTUnwrap(viewModel.entry)
        updated.title = "Renamed elsewhere"
        try await repo.save(updated)

        // Let the live stream emission land.
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(viewModel.entry?.title, "Renamed elsewhere")
    }
}
