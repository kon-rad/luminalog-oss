import XCTest
@testable import LuminaLog

/// HomeViewModel consumes async streams, so tests drive the mocks and poll
/// the published state with a bounded wait (same pattern as SessionStoreTests).
final class HomeViewModelTests: XCTestCase {

    /// Counts `dailyPrompt()` calls and returns instantly — deterministic
    /// replacement for MockAIService's ~1s canned delay.
    @MainActor
    private final class SpyAIService: AIService {
        private(set) var dailyPromptCalls = 0
        var dailyPromptResult = StoryPromptType.allCases.map(\.fallback)

        func dailyPrompt() async throws -> [DailyPromptItem] {
            dailyPromptCalls += 1
            return dailyPromptResult
        }

        func generateSummary(journalId: String) async throws -> AIGeneration {
            AIGeneration(text: "", model: "spy")
        }
        func generateInsights(journalId: String) async throws -> AIGeneration {
            AIGeneration(text: "", model: "spy")
        }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async {}
        func deleteEntry(journalId: String) async throws {}
        func transcribeJournal(journalId: String) async {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
            throw URLError(.cancelled)
        }
    }

    @MainActor
    private func makeProfile(promptText: String?, promptDate: Date?) -> UserProfile {
        var profile = MockData.profile
        if let promptText, let promptDate {
            profile.dailyPrompt = UserProfile.DailyPrompt(text: promptText, date: promptDate)
        } else {
            profile.dailyPrompt = nil
        }
        return profile
    }

    /// Polls `condition` until it holds or the timeout elapses, then asserts.
    @MainActor
    private func waitUntil(
        timeout: TimeInterval = 2,
        _ message: String,
        _ condition: () -> Bool
    ) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTAssertTrue(condition(), message)
    }

    @MainActor
    func testOldAreaCacheIsReplacedWithEightStoryQuestions() async throws {
        let ai = SpyAIService()
        var profile = makeProfile(promptText: "Cached area?", promptDate: Date())
        profile.id = UUID().uuidString
        let viewModel = HomeViewModel(
            journals: MockJournalRepository(), profiles: MockProfileRepository(profile: profile), ai: ai,
            dailyReports: MockDailyReportRepository(), activity: AppActivityMonitor(),
            drafts: DraftStore(directory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString))
        )
        viewModel.start()
        await waitUntil("eight Story questions loaded") { viewModel.displayedPrompts.count == 8 }
        XCTAssertEqual(ai.dailyPromptCalls, 1)
        XCTAssertEqual(viewModel.displayedPrompts.map(\.storyType), StoryPromptType.allCases.map(\.rawValue))
    }

    @MainActor
    func testLocalMidnightInvalidatesBothProfileAndInMemoryPromptCaches() async throws {
        let ai = SpyAIService()
        var clock = Date()
        var profile = makeProfile(promptText: "Cached yesterday?", promptDate: clock)
        profile.id = UUID().uuidString
        let model = HomeViewModel(
            journals: MockJournalRepository(), profiles: MockProfileRepository(profile: profile), ai: ai,
            dailyReports: MockDailyReportRepository(), activity: AppActivityMonitor(),
            drafts: DraftStore(directory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)),
            promptNow: { clock }
        )
        model.start()
        await waitUntil("first day loaded") { model.displayedPrompts.count == 8 }
        await model.refreshPromptDay()
        XCTAssertEqual(ai.dailyPromptCalls, 1)
        clock = clock.addingTimeInterval(86400)
        await model.refreshPromptDay()
        XCTAssertEqual(ai.dailyPromptCalls, 2)
        await model.refreshPromptDay()
        XCTAssertEqual(ai.dailyPromptCalls, 2, "same day uses the fetched cache")
        clock = clock.addingTimeInterval(86400)
        await model.refreshPromptDay()
        XCTAssertEqual(ai.dailyPromptCalls, 3, "the in-memory cache expires too")
        UserDefaults.standard.removeObject(forKey: "story-prompts.\(profile.id).history")
    }

    // MARK: - Daily prompt

    @MainActor
    func testOldProfilePromptIsRefreshedOnce() async {
        let ai = SpyAIService()
        let profile = makeProfile(promptText: "Today's cached prompt", promptDate: Date())
        let viewModel = HomeViewModel(
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(profile: profile),
            ai: ai,
            dailyReports: MockDailyReportRepository(),
            activity: AppActivityMonitor(),
            drafts: DraftStore(directory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString))
        )

        viewModel.start()

        await waitUntil("Story questions replace the old cache") { viewModel.displayedPrompts.count == 8 }
        XCTAssertEqual(ai.dailyPromptCalls, 1)
    }

    @MainActor
    func testCallsAIServiceWhenProfilePromptIsStale() async {
        let ai = SpyAIService()
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let profile = makeProfile(promptText: "Yesterday's prompt", promptDate: yesterday)
        let viewModel = HomeViewModel(
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(profile: profile),
            ai: ai,
            dailyReports: MockDailyReportRepository(),
            activity: AppActivityMonitor(),
            drafts: DraftStore(directory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString))
        )

        viewModel.start()

        await waitUntil("Stale profile prompt falls back to the AI service") {
            viewModel.promptState == .loaded(ai.dailyPromptResult)
        }
        XCTAssertEqual(ai.dailyPromptCalls, 1)
    }

    @MainActor
    func testCallsAIServiceWhenProfileHasNoPrompt() async {
        let ai = SpyAIService()
        let profile = makeProfile(promptText: nil, promptDate: nil)
        let viewModel = HomeViewModel(
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(profile: profile),
            ai: ai,
            dailyReports: MockDailyReportRepository(),
            activity: AppActivityMonitor(),
            drafts: DraftStore(directory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString))
        )

        viewModel.start()

        await waitUntil("Missing profile prompt falls back to the AI service") {
            viewModel.promptState == .loaded(ai.dailyPromptResult)
        }
        XCTAssertEqual(ai.dailyPromptCalls, 1)
    }

    // MARK: - Recent entries

    @MainActor
    func testRecentEntriesCappedAtTen() async {
        XCTAssertGreaterThan(MockData.journalEntries.count, 10,
                             "Seed data must exceed the cap for this test to be meaningful")

        let viewModel = HomeViewModel(
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(),
            ai: SpyAIService(),
            dailyReports: MockDailyReportRepository(),
            activity: AppActivityMonitor(),
            drafts: DraftStore(directory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString))
        )

        viewModel.start()

        await waitUntil("Recent entries stream emits") {
            viewModel.recentEntries != nil
        }
        XCTAssertEqual(viewModel.recentEntries?.count, HomeViewModel.recentLimit)

        // Newest first — the cap keeps the latest entries.
        let expected = Array(MockData.journalEntries
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(HomeViewModel.recentLimit))
            .map(\.id)
        XCTAssertEqual(viewModel.recentEntries?.map(\.id), Array(expected))
    }

    @MainActor
    func testProcessingEntryFlagDrivenFromRecentEntries() {
        let monitor = AppActivityMonitor()
        let processing = JournalEntry(
            id: "p1", userId: "u", type: .voice, title: "t",
            createdAt: Date(), content: "", media: [],
            transcriptStatus: nil, processingStatus: .transcribing, wordCount: 0)
        XCTAssertTrue(HomeViewModel.anyProcessing([processing]))
        let ready = JournalEntry(
            id: "r1", userId: "u", type: .text, title: "t",
            createdAt: Date(), content: "hi", media: [],
            transcriptStatus: .ready, processingStatus: nil, wordCount: 1)
        XCTAssertFalse(HomeViewModel.anyProcessing([ready]))
        _ = monitor // silence unused in case the helper isn't needed
    }

    /// Regression: after server-side transcription finishes it sets
    /// `transcriptStatus = .ready` but never clears the local
    /// `processingStatus = .transcribing` the finalizer wrote. `anyProcessing`
    /// must reconcile via `activityState` (like the UI does) so the entry is
    /// treated as settled — otherwise the interruption gate stays closed
    /// forever and the 750-word milestone popup can never present.
    @MainActor
    func testProcessingEntryFlagClearsWhenServerTranscriptIsReady() {
        let transcribed = JournalEntry(
            id: "v1", userId: "u", type: .voice, title: "t",
            createdAt: Date(), content: "a long transcript", media: [],
            transcriptStatus: .ready, processingStatus: .transcribing, wordCount: 800)
        XCTAssertFalse(
            HomeViewModel.anyProcessing([transcribed]),
            "A voice entry whose server transcript is ready should not count as processing")
    }
}
