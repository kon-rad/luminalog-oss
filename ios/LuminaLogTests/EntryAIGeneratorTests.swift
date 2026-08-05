import XCTest
@testable import LuminaLog

/// Headless entry-AI generation: at-save + launch-sweep production of an entry's
/// summary/insights/prompts, with de-dup and a per-session attempt cap, so an entry
/// is never stuck "pending" until the user opens it.
@MainActor
final class EntryAIGeneratorTests: XCTestCase {

    override func setUp() { super.setUp(); DevFlags.aiModel1 = true }
    override func tearDown() { DevFlags.aiModel1 = false; super.tearDown() }

    // A minimal AIService that records generate calls and can delay / throw.
    private final class SpyAI: AIService {
        private(set) var generateEntryAICalls: [String] = []
        var delayNanos: UInt64 = 0
        var errorToThrow: Error?
        var bundle = EntryAIBundle(
            summary: AIGeneration(text: "fresh summary", model: "m"),
            insights: AIGeneration(text: "fresh insights", model: "m"),
            prompts: AIPrompts(items: ["What next?"], model: "m"))

        func generateEntryAI(journalId: String) async throws -> EntryAIBundle {
            generateEntryAICalls.append(journalId)
            if delayNanos > 0 { try await Task.sleep(nanoseconds: delayNanos) }
            if let errorToThrow { throw errorToThrow }
            return bundle
        }

        func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func dailyPrompt() async throws -> [DailyPromptItem] { [] }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async {}
        func deleteEntry(journalId: String) async throws {}
        func transcribeJournal(journalId: String) async throws {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport { throw URLError(.cancelled) }
    }

    private struct SpyError: Error {}

    private func entry(
        id: String,
        content: String = "A reasonably long journal entry worth summarizing.",
        summary: AIGeneration? = nil,
        insights: AIGeneration? = nil,
        prompts: AIPrompts? = nil
    ) -> JournalEntry {
        JournalEntry(id: id, userId: "u", type: .text, title: "t", content: content,
                     summary: summary, insights: insights, prompts: prompts)
    }

    // MARK: - ensureAI

    func testGeneratesAndPersistsForMissingAIEntry() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        let did = await gen.ensureAI(for: "e1")

        XCTAssertTrue(did)
        XCTAssertEqual(ai.generateEntryAICalls, ["e1"])
        let stored = (try? await journals.fetchAllEntries())?.first { $0.id == "e1" }
        XCTAssertEqual(stored?.summary?.text, "fresh summary")
        XCTAssertEqual(stored?.insights?.text, "fresh insights")
        XCTAssertEqual(stored?.prompts?.items, ["What next?"])
    }

    func testSkipsEmptyContent() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1", content: "")])
        let ai = SpyAI()
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        let did = await gen.ensureAI(for: "e1")

        XCTAssertFalse(did)
        XCTAssertTrue(ai.generateEntryAICalls.isEmpty)
    }

    func testSkipsEntryThatAlreadyHasAI() async {
        let complete = entry(
            id: "e1",
            summary: AIGeneration(text: "s", model: "m"),
            insights: AIGeneration(text: "i", model: "m"),
            prompts: AIPrompts(items: ["p?"], model: "m"))
        let journals = MockJournalRepository(entries: [complete])
        let ai = SpyAI()
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        let did = await gen.ensureAI(for: "e1")

        XCTAssertFalse(did)
        XCTAssertTrue(ai.generateEntryAICalls.isEmpty)
    }

    func testConcurrentEnsureDedupsToOneCall() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        ai.delayNanos = 50_000_000 // hold the first call in flight while the second checks
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        async let a = gen.ensureAI(for: "e1")
        async let b = gen.ensureAI(for: "e1")
        let results = await [a, b]

        // Exactly one generation ran; the other saw the in-flight claim and bailed.
        XCTAssertEqual(ai.generateEntryAICalls.count, 1)
        XCTAssertEqual(results.filter { $0 }.count, 1)
    }

    func testAttemptCapStopsAfterThreeFailures() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        ai.errorToThrow = SpyError()
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        for _ in 0..<6 { _ = await gen.ensureAI(for: "e1") }

        // Bounded to maxSessionAttempts (3) despite six calls.
        XCTAssertEqual(ai.generateEntryAICalls.count, 3)
    }

    func testCancellationDoesNotConsumeAttempt() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        ai.errorToThrow = URLError(.cancelled)
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        for _ in 0..<5 { _ = await gen.ensureAI(for: "e1") }

        // A cancellation isn't a real failure — every call retries (cap not consumed).
        XCTAssertEqual(ai.generateEntryAICalls.count, 5)
    }

    // MARK: - sweep

    func testSweepGeneratesForEveryNeedingEntryAndSkipsComplete() async {
        let complete = entry(
            id: "done",
            summary: AIGeneration(text: "s", model: "m"),
            insights: AIGeneration(text: "i", model: "m"),
            prompts: AIPrompts(items: ["p?"], model: "m"))
        let journals = MockJournalRepository(entries: [
            entry(id: "n1"),
            entry(id: "empty", content: ""),
            complete,
            entry(id: "n2"),
        ])
        let ai = SpyAI()
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        await gen.sweep()

        XCTAssertEqual(Set(ai.generateEntryAICalls), ["n1", "n2"])
    }
}
