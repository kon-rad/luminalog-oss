import XCTest
@testable import LuminaLog

@MainActor
final class EntryEditViewModelTests: XCTestCase {

    private final class SpyAI: AIService {
        var indexCalls = 0
        func generateSummary(journalId: String) async throws -> AIGeneration { .init(text: "", model: "") }
        func generateInsights(journalId: String) async throws -> AIGeneration { .init(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> [DailyPromptItem] { [] }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async { indexCalls += 1 }
        func transcribeJournal(journalId: String) async throws {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
        func deleteEntry(journalId: String) async throws {}
        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
            throw URLError(.cancelled)
        }
    }

    private func makeVM(
        _ entry: JournalEntry,
        repo: MockJournalRepository,
        ai: SpyAI,
        profiles: MockProfileRepository
    ) -> EntryEditViewModel {
        EntryEditViewModel(entry: entry, journals: repo, profiles: profiles, ai: ai)
    }

    func testContentEditReindexesAndSetsContentEditedAt() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai, profiles: MockProfileRepository())
        vm.content = "New body"
        await vm.save()

        XCTAssertTrue(vm.didSave)
        XCTAssertEqual(ai.indexCalls, 1)
        let saved = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(saved?.content, "New body")
        XCTAssertNotNil(saved?.contentEditedAt)
        XCTAssertEqual(saved?.editHistory.first?.fields, ["content"])
    }

    func testTitleOnlyEditDoesNotReindex() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai, profiles: MockProfileRepository())
        vm.title = "New title"
        await vm.save()

        XCTAssertTrue(vm.didSave)
        XCTAssertEqual(ai.indexCalls, 0)
        let saved = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(saved?.title, "New title")
        XCTAssertNil(saved?.contentEditedAt)
        XCTAssertEqual(saved?.editHistory.first?.fields, ["title"])
    }

    func testNoChangeWritesNothing() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai, profiles: MockProfileRepository())
        await vm.save()

        XCTAssertTrue(vm.didSave)
        XCTAssertEqual(ai.indexCalls, 0)
        let saved = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(saved?.editHistory.count, 0)
    }

    func testContentEditPersistsWordCountAndCreditsDeltaToLifetimeTotal() async throws {
        let createdAt = Date(timeIntervalSince1970: 1_700_000_000)
        let entry = JournalEntry(
            id: "e1", userId: "u", type: .text, title: "T",
            createdAt: createdAt, content: "one two three", wordCount: 3
        )
        let repo = MockJournalRepository(entries: [entry])
        let profiles = MockProfileRepository()
        let vm = makeVM(entry, repo: repo, ai: SpyAI(), profiles: profiles)

        vm.content = "one two three four five"   // 5 words → delta +2
        await vm.save()

        // The daily-goal recompute is driven by the app-level reconciler, so the
        // edit only credits the lifetime word delta here.
        XCTAssertEqual(profiles.recordedDeltas, [2])
        let saved = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(saved?.wordCount, 5)
    }

    func testTitleOnlyEditDoesNotCreditWords() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "one two", wordCount: 2)
        let repo = MockJournalRepository(entries: [entry])
        let profiles = MockProfileRepository()
        let vm = makeVM(entry, repo: repo, ai: SpyAI(), profiles: profiles)

        vm.title = "New Title"
        await vm.save()

        XCTAssertTrue(profiles.recordedDeltas.isEmpty)
    }

    func testDeletedMidEditSurfacesMessage() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [])   // entry already gone
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai, profiles: MockProfileRepository())
        vm.content = "changed"
        await vm.save()

        XCTAssertNotNil(vm.errorMessage)
        XCTAssertTrue(vm.didSave)   // dismiss
    }
}
