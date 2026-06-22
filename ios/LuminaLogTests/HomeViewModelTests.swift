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
        var dailyPromptResult = "Spy daily prompt"

        func dailyPrompt() async throws -> String {
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

    // MARK: - Daily prompt

    @MainActor
    func testUsesTodaysProfilePromptWithoutCallingAIService() async {
        let ai = SpyAIService()
        let profile = makeProfile(promptText: "Today's cached prompt", promptDate: Date())
        let viewModel = HomeViewModel(
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(profile: profile),
            ai: ai,
            dailyReports: MockDailyReportRepository()
        )

        viewModel.start()

        await waitUntil("Today's profile prompt is shown") {
            viewModel.promptState == .loaded("Today's cached prompt")
        }
        // Give a potential stray fetch a beat to surface before asserting.
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(ai.dailyPromptCalls, 0,
                       "A fresh profile prompt must not trigger an AI call")
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
            dailyReports: MockDailyReportRepository()
        )

        viewModel.start()

        await waitUntil("Stale profile prompt falls back to the AI service") {
            viewModel.promptState == .loaded("Spy daily prompt")
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
            dailyReports: MockDailyReportRepository()
        )

        viewModel.start()

        await waitUntil("Missing profile prompt falls back to the AI service") {
            viewModel.promptState == .loaded("Spy daily prompt")
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
            dailyReports: MockDailyReportRepository()
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
}
