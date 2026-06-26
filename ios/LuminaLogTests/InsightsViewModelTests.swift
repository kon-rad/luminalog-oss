import XCTest
@testable import LuminaLog

final class InsightsViewModelTests: XCTestCase {

    @MainActor
    func testLoadProducesLoadedInsights() async {
        let entries = [
            JournalEntry(userId: "u", type: .text, title: "", createdAt: Date(),
                         content: "garden flowers garden", wordCount: 3,
                         emotion: EmotionScore(source: "text", scores: ["joy": 0.9],
                                               top: [EmotionScore.Pick(name: "joy", score: 0.9)])),
            JournalEntry(userId: "u", type: .voice, title: "",
                         createdAt: Date().addingTimeInterval(-3600),
                         content: "morning run", wordCount: 2)
        ]
        let vm = InsightsViewModel(journals: MockJournalRepository(entries: entries))
        await vm.load()

        guard case .loaded(let insights) = vm.state else {
            return XCTFail("expected .loaded, got \(vm.state)")
        }
        XCTAssertFalse(insights.words.isEmpty)
        XCTAssertEqual(insights.types.map(\.type).sorted { $0.rawValue < $1.rawValue },
                       [.text, .voice].sorted { $0.rawValue < $1.rawValue })
        XCTAssertEqual(insights.emotionTrend.first?.emotion, "joy")
        XCTAssertFalse(insights.activity.isEmpty)
    }

    @MainActor
    func testLoadWithNoEntriesIsEmptyState() async {
        let vm = InsightsViewModel(journals: MockJournalRepository(entries: []))
        await vm.load()
        XCTAssertEqual(vm.state, .empty)
    }

    @MainActor
    func testLoadCollapsesToEmptyWhenNoMeaningfulCards() async {
        // One old (outside the activity window), empty, single-type, unscored
        // entry → no card is meaningful, so a loaded result collapses to .empty.
        let old = Date().addingTimeInterval(-200 * 24 * 3600)
        let entries = [
            JournalEntry(userId: "u", type: .text, title: "", createdAt: old,
                         content: "", wordCount: 0)
        ]
        let vm = InsightsViewModel(journals: MockJournalRepository(entries: entries))
        await vm.load()
        XCTAssertEqual(vm.state, .empty)
    }

    @MainActor
    func testLoadFailureIsFailedState() async {
        let vm = InsightsViewModel(journals: ThrowingRepo())
        await vm.load()
        XCTAssertEqual(vm.state, .failed)
    }

    @MainActor
    private final class ThrowingRepo: JournalRepository {
        struct Boom: Error {}
        func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> { AsyncStream { $0.finish() } }
        func entries(after: Date?, limit: Int) async throws -> [JournalEntry] { [] }
        func fetchAllEntries() async throws -> [JournalEntry] { throw Boom() }
        func entry(id: String) -> AsyncStream<JournalEntry?> { AsyncStream { $0.finish() } }
        func save(_ entry: JournalEntry) async throws {}
        func updateAIFields(id: String, summary: AIGeneration?, insights: AIGeneration?, prompts: AIPrompts?) async throws {}
        func updateContent(id: String, content: String, wordCount: Int, contentEditedAt: Date, appendedMedia: [MediaItem]) async throws {}
        func applyEntryEdit(id: String, title: String, content: String, wordCount: Int, contentEditedAt: Date?, edit: EditRecord) async throws {}
        func delete(id: String) async throws {}
        func setExcludeFromShare(entryId: String, value: Bool) async throws {}
        func countEntries(on date: Date, excluding draftId: String) async throws -> Int { 0 }
    }
}
