import XCTest
@testable import LuminaLog

@MainActor
final class RelatedViewModelTests: XCTestCase {

    func testLoadPopulatesEntries() async {
        let vm = RelatedViewModel(entryId: "e1", ai: MockAIService())
        await vm.load()
        if case .loaded(let items) = vm.state {
            XCTAssertEqual(items.count, 2)
        } else {
            XCTFail("expected loaded state, got \(vm.state)")
        }
    }

    func testLoadIsIdempotent() async {
        let vm = RelatedViewModel(entryId: "e1", ai: MockAIService())
        await vm.load()
        await vm.load()
        if case .loaded(let items) = vm.state {
            XCTAssertEqual(items.count, 2)
        } else {
            XCTFail("expected loaded state")
        }
    }

    func testFailureSetsErrorState() async {
        let vm = RelatedViewModel(entryId: "e1", ai: StubFailingAIService())
        await vm.load()
        if case .failed = vm.state {} else { XCTFail("expected failed state") }
    }
}

// MARK: - Stub

/// Conforms directly to AIService (MockAIService is final and cannot be subclassed).
/// All methods return trivial values; only `relatedEntries` throws.
@MainActor
private final class StubFailingAIService: AIService {

    func generateSummary(journalId: String) async throws -> AIGeneration {
        AIGeneration(text: "", model: "stub")
    }

    func generateInsights(journalId: String) async throws -> AIGeneration {
        AIGeneration(text: "", model: "stub")
    }

    func generatePrompts(journalId: String) async throws -> [String] { [] }

    func dailyPrompt() async throws -> String { "" }

    func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { $0.finish() }
    }

    func requestIndex(journalId: String) async {}
    func deleteEntry(journalId: String) async throws {}

    func transcribeJournal(journalId: String) async throws {}

    func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }

    func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] {
        throw URLError(.badServerResponse)
    }
    func searchKeyword(query: String) async throws -> [SearchResult] { [] }
    func searchSemantic(query: String) async throws -> [SearchResult] { [] }
    func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
    func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
        throw URLError(.cancelled)
    }
}
