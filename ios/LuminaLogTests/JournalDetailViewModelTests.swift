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
        var transcribeCalls = 0

        var delayNanos: UInt64 = 0
        var shouldFail = false
        var shouldFailTranscribe = false

        func generateSummary(journalId: String) async throws -> AIGeneration {
            summaryCalls += 1
            try await waitAndMaybeFail()
            return AIGeneration(text: "spy summary", model: "spy")
        }

        var entryAICalls = 0
        func generateEntryAI(journalId: String) async throws -> EntryAIBundle {
            entryAICalls += 1
            try await waitAndMaybeFail()
            return EntryAIBundle(
                summary: AIGeneration(text: "spy summary", model: "spy"),
                insights: AIGeneration(text: "spy insights", model: "spy"),
                prompts: AIPrompts(items: ["What next?"], model: "spy")
            )
        }

        func dailyPrompt() async throws -> [DailyPromptItem] { [DailyPromptItem(area: "Inner World", text: "spy daily prompt")] }

        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }

        func requestIndex(journalId: String) async {}

        var deleteCalls = 0
        var shouldFailDelete = false
        func deleteEntry(journalId: String) async throws {
            deleteCalls += 1
            if shouldFailDelete { throw SpyError() }
        }

        var transcribeClipCalls = 0
        var shouldFailTranscribeClip = false
        var clipTranscript = "spy clip transcript"
        func transcribeClip(audio: Data, contentType: String) async throws -> String {
            transcribeClipCalls += 1
            // Suspend like a real network call so the loading guard can observe
            // an in-flight retry (otherwise concurrent retries can't be tested).
            if delayNanos > 0 {
                try await Task.sleep(nanoseconds: delayNanos)
            }
            if shouldFailTranscribeClip {
                throw SpyError()
            }
            return clipTranscript
        }

        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }

        func transcribeJournal(journalId: String) async throws {
            transcribeCalls += 1
            // Suspend like a real network call so the loading guard can observe
            // an in-flight retry (otherwise concurrent retries can't be tested).
            if delayNanos > 0 {
                try await Task.sleep(nanoseconds: delayNanos)
            }
            if shouldFailTranscribe {
                throw SpyError()
            }
        }

        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
            throw URLError(.cancelled)
        }

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
    func testEmptyPromptsBackfillRegeneratesOnZeroKnowledgePath() async throws {
        let saved = DevFlags.aiModel1
        DevFlags.aiModel1 = true
        defer { DevFlags.aiModel1 = saved }

        // Entry has a summary + insights but the follow-up prompts landed empty
        // (the server dropped them). On the ZK path that counts as missing, so the
        // one-call entry-AI regenerates and backfills prompts (ADR-0081) instead of
        // leaving the Prompts tab stuck.
        let entry = makeEntry(
            summary: AIGeneration(text: "existing", model: "m"),
            insights: AIGeneration(text: "existing insights", model: "m"),
            prompts: AIPrompts(items: [], model: "m")
        )
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        XCTAssertEqual(ai.entryAICalls, 1, "Empty prompts trigger one entry-AI regeneration")
        XCTAssertEqual(ai.summaryCalls, 0, "The ZK path uses generateEntryAI, not generateSummary")
        XCTAssertEqual(viewModel.entry?.prompts?.items, ["What next?"])

        let stored = try await storedEntry(id: "entry-1", in: repo)
        XCTAssertEqual(stored?.prompts?.items, ["What next?"], "Backfilled prompts persist")
    }

    @MainActor
    func testFullyPopulatedEntryDoesNotRegenerateOnZeroKnowledgePath() async {
        let saved = DevFlags.aiModel1
        DevFlags.aiModel1 = true
        defer { DevFlags.aiModel1 = saved }

        let entry = makeEntry(
            summary: AIGeneration(text: "s", model: "m"),
            insights: AIGeneration(text: "i", model: "m"),
            prompts: AIPrompts(items: ["Q?"], model: "m")
        )
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()

        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        XCTAssertEqual(ai.entryAICalls, 0, "A fully-populated entry never regenerates")
        XCTAssertEqual(ai.summaryCalls, 0)
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

    /// Regression for the "generate → clear → regenerate" waste: a voice entry
    /// opens before its transcript lands (empty content), the transcript then
    /// arrives via a background full-document save, and a *second* background
    /// save (status settle) races in afterwards. The summary must generate
    /// EXACTLY ONCE and survive the racing save — no clobber, no second LLM call.
    @MainActor
    func testLateContentGeneratesOnceAndSurvivesRacingSave() async throws {
        let pending = JournalEntry(
            id: "v1",
            userId: MockData.userId,
            type: .voice,
            title: "Voice note",
            content: "",                       // transcript not ready yet
            processingStatus: .transcribing
        )
        let repo = MockJournalRepository(entries: [pending])
        let ai = SpyAIService()

        let viewModel = JournalDetailViewModel(entryId: "v1", journals: repo, ai: ai)
        await viewModel.start()
        XCTAssertEqual(ai.summaryCalls, 0, "Nothing to summarize while content is empty")

        // Transcript arrives — background save with content but no AI fields.
        var transcribed = pending
        transcribed.content = "Some transcribed words worth summarizing."
        transcribed.processingStatus = .ready
        try await repo.save(transcribed)
        try await Task.sleep(nanoseconds: 200_000_000)   // listener lands + generates

        XCTAssertEqual(ai.summaryCalls, 1, "Content arrival triggers exactly one generation")
        XCTAssertEqual(viewModel.entry?.summary?.text, "spy summary")

        // A later racing pipeline save (still no AI fields) must neither wipe the
        // summary nor trigger a second generation.
        var settled = transcribed
        settled.processingStatus = nil
        try await repo.save(settled)
        try await Task.sleep(nanoseconds: 200_000_000)

        XCTAssertEqual(viewModel.entry?.summary?.text, "spy summary", "Racing save must not clobber the summary")
        XCTAssertEqual(ai.summaryCalls, 1, "No second, wasteful LLM call")
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

    // Insights and prompts are generated server-side (with the summary) at index
    // time and only displayed by the client, so there is no client-side
    // generation to unit-test here — see the server suite (summaryService /
    // summaryGenerator) for their generation + persistence coverage.

    // MARK: - In-flight guards

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

        // Delete the entry while a summary (re)generation is still in flight.
        async let generation: Void = viewModel.generateSummary()
        try await Task.sleep(nanoseconds: 30_000_000)
        try await repo.delete(id: "entry-1")
        await generation

        let stored = try await storedEntry(id: "entry-1", in: repo)
        XCTAssertNil(stored, "Persisting an AI field must never recreate a deleted entry")
        XCTAssertEqual(viewModel.summaryState, .idle, "Not-found persistence is a silent no-op")
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

    // MARK: - Transcript retry

    /// Minimal `MediaUploader` for the zero-knowledge retry path: resolves a real
    /// on-disk file for the entry's audio clip so `retryTranscription` can read
    /// the bytes and hand them to `transcribeClip`.
    @MainActor
    private final class StubMedia: MediaUploader {
        struct Unused: Error {}
        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem { throw Unused() }
        func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload { throw Unused() }
        func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int, journalId: String) async throws -> (s3Key: String, url: URL) { throw Unused() }
        func viewURL(for s3Key: String) async throws -> URL { throw Unused() }
        func localFileURL(for s3Key: String) async throws -> URL {
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("\(UUID().uuidString).m4a")
            try Data([0x1, 0x2, 0x3, 0x4]).write(to: url)
            return url
        }
    }

    /// A voice entry whose transcription failed: audio media item present,
    /// `transcriptStatus: .failed`. One typed fallback word so a longer retry
    /// transcript produces a positive word delta.
    @MainActor
    private func makeFailedVoiceEntry(id: String = "entry-1") -> JournalEntry {
        JournalEntry(
            id: id,
            userId: MockData.userId,
            type: .voice,
            title: "Voice note",
            content: "Typed.",
            media: [MediaItem(s3Key: "audio-key.m4a", kind: .audio)],
            transcriptStatus: .failed,
            summary: AIGeneration(text: "s", model: "m"),
            wordCount: 1
        )
    }

    @MainActor
    func testRetryTranscriptionTranscribesClipAndCreditsWordDelta() async {
        let repo = MockJournalRepository(entries: [makeFailedVoiceEntry()])
        let ai = SpyAIService()
        ai.clipTranscript = "one two three four five"   // 5 words; entry had 1 → +4
        let profiles = MockProfileRepository()

        let viewModel = JournalDetailViewModel(
            entryId: "entry-1", journals: repo, ai: ai, media: StubMedia(), profiles: profiles)
        await viewModel.start()
        XCTAssertEqual(viewModel.entry?.transcriptStatus, .failed)

        await viewModel.retryTranscription()

        XCTAssertEqual(ai.transcribeClipCalls, 1, "Retry transcribes the clip on-device (zero-knowledge)")
        XCTAssertEqual(viewModel.transcriptRetryState, .idle)
        XCTAssertEqual(viewModel.entry?.content, "one two three four five")
        XCTAssertEqual(viewModel.entry?.transcriptStatus, .ready)
        XCTAssertEqual(viewModel.entry?.wordCount, 5)
        // The regression: a failed-then-retried transcription now credits the
        // recovered words to the lifetime odometer (+4). The daily-goal total
        // itself is reconciled from today's entries by DailyGoalReconciler.
        XCTAssertEqual(profiles.recordedDeltas, [4])
    }

    @MainActor
    func testRetryTranscriptionFailureSetsFailedState() async {
        let repo = MockJournalRepository(entries: [makeFailedVoiceEntry()])
        let ai = SpyAIService()
        ai.shouldFailTranscribeClip = true
        let profiles = MockProfileRepository()

        let viewModel = JournalDetailViewModel(
            entryId: "entry-1", journals: repo, ai: ai, media: StubMedia(), profiles: profiles)
        await viewModel.start()

        await viewModel.retryTranscription()

        XCTAssertEqual(ai.transcribeClipCalls, 1)
        XCTAssertEqual(viewModel.transcriptRetryState, .failed)
        XCTAssertEqual(viewModel.entry?.content, "Typed.", "Failure leaves the entry untouched")
        XCTAssertEqual(viewModel.entry?.transcriptStatus, .failed)
        XCTAssertTrue(profiles.recordedDeltas.isEmpty, "A failed retry credits nothing")
    }

    @MainActor
    func testRetryTranscriptionDoubleTapFiresOnce() async {
        let repo = MockJournalRepository(entries: [makeFailedVoiceEntry()])
        let ai = SpyAIService()
        ai.delayNanos = 100_000_000

        let viewModel = JournalDetailViewModel(
            entryId: "entry-1", journals: repo, ai: ai, media: StubMedia())
        await viewModel.start()

        async let first: Void = viewModel.retryTranscription()
        async let second: Void = viewModel.retryTranscription()
        _ = await (first, second)

        XCTAssertEqual(ai.transcribeClipCalls, 1, "Loading guard blocks duplicate retry calls")
    }

    // MARK: - Delete

    @MainActor
    func testDeleteCallsRemoteThenRemovesRecord() async throws {
        let repo = MockJournalRepository(entries: [makeEntry()])
        let ai = SpyAIService()
        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        await viewModel.delete()

        XCTAssertEqual(ai.deleteCalls, 1)
        XCTAssertTrue(viewModel.didDelete)
        let remaining = try await storedEntry(id: "entry-1", in: repo)
        XCTAssertNil(remaining)
    }

    @MainActor
    func testDeleteRemovesRecordEvenWhenRemoteFails() async throws {
        let repo = MockJournalRepository(entries: [makeEntry()])
        let ai = SpyAIService()
        ai.shouldFailDelete = true
        let viewModel = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await viewModel.start()

        await viewModel.delete()

        XCTAssertTrue(viewModel.didDelete)
        let remaining = try await storedEntry(id: "entry-1", in: repo)
        XCTAssertNil(remaining)
    }
}
