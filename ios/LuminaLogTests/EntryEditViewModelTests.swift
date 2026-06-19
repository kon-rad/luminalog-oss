import XCTest
@testable import LuminaLog

@MainActor
final class EntryEditViewModelTests: XCTestCase {

    private final class SpyAI: AIService {
        var indexCalls = 0
        func generateSummary(journalId: String) async throws -> AIGeneration { .init(text: "", model: "") }
        func generateInsights(journalId: String) async throws -> AIGeneration { .init(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> String { "" }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async { indexCalls += 1 }
        func transcribeJournal(journalId: String) async throws {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func deleteEntry(journalId: String) async throws {}
    }

    private func makeVM(_ entry: JournalEntry, repo: MockJournalRepository, ai: SpyAI) -> EntryEditViewModel {
        EntryEditViewModel(entry: entry, journals: repo, ai: ai)
    }

    func testContentEditReindexesAndSetsContentEditedAt() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai)
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
        let vm = makeVM(entry, repo: repo, ai: ai)
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
        let vm = makeVM(entry, repo: repo, ai: ai)
        await vm.save()

        XCTAssertTrue(vm.didSave)
        XCTAssertEqual(ai.indexCalls, 0)
        let saved = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(saved?.editHistory.count, 0)
    }

    func testDeletedMidEditSurfacesMessage() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [])   // entry already gone
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai)
        vm.content = "changed"
        await vm.save()

        XCTAssertNotNil(vm.errorMessage)
        XCTAssertTrue(vm.didSave)   // dismiss
    }
}
