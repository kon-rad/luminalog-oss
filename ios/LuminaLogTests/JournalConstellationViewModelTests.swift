import XCTest
@testable import LuminaLog

@MainActor
final class JournalConstellationViewModelTests: XCTestCase {

    func testLoadSuccessMovesToLoaded() async {
        let vm = JournalConstellationViewModel(ai: MockAIService())
        await vm.load()
        if case .loaded(let graph) = vm.state {
            XCTAssertEqual(graph.nodes.count, 3)
        } else {
            XCTFail("expected .loaded, got \(vm.state)")
        }
    }

    func testLoadFailureMovesToFailed() async {
        let vm = JournalConstellationViewModel(ai: FailingAIService())
        await vm.load()
        if case .failed = vm.state {} else {
            XCTFail("expected .failed, got \(vm.state)")
        }
    }

    func testEmptyGraphMovesToEmpty() async {
        let vm = JournalConstellationViewModel(ai: EmptyGraphAIService())
        await vm.load()
        if case .empty = vm.state {} else {
            XCTFail("expected .empty, got \(vm.state)")
        }
    }
}

// `MockAIService` is `final`, so these stand-ins conform to `AIService`
// directly. They override only `journalGraph()`; everything else is a no-op.
@MainActor
private final class FailingAIService: AIService {
    func journalGraph() async throws -> JournalGraph {
        throw URLError(.notConnectedToInternet)
    }
}

@MainActor
private final class EmptyGraphAIService: AIService {
    func journalGraph() async throws -> JournalGraph {
        JournalGraph(nodes: [], links: [])
    }
}

// Shared no-op implementations for the rest of the `AIService` protocol.
extension FailingAIService {
    func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
    func generateInsights(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
    func generatePrompts(journalId: String) async throws -> [String] { [] }
    func dailyPrompt() async throws -> [DailyPromptItem] { [] }
    func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { $0.finish() }
    }
    func requestIndex(journalId: String) async {}
    func transcribeJournal(journalId: String) async throws {}
    func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
    func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
    func deleteEntry(journalId: String) async throws {}
    func searchKeyword(query: String) async throws -> [SearchResult] { [] }
    func searchSemantic(query: String) async throws -> [SearchResult] { [] }
    func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
        throw URLError(.cancelled)
    }
}

extension EmptyGraphAIService {
    func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
    func generateInsights(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
    func generatePrompts(journalId: String) async throws -> [String] { [] }
    func dailyPrompt() async throws -> [DailyPromptItem] { [] }
    func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { $0.finish() }
    }
    func requestIndex(journalId: String) async {}
    func transcribeJournal(journalId: String) async throws {}
    func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
    func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
    func deleteEntry(journalId: String) async throws {}
    func searchKeyword(query: String) async throws -> [SearchResult] { [] }
    func searchSemantic(query: String) async throws -> [SearchResult] { [] }
    func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
        throw URLError(.cancelled)
    }
}
