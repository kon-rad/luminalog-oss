import XCTest
@testable import LuminaLog

/// Headless cognitive-map generation: at-save production plus the bounded launch
/// backfill, with de-dup and a per-session attempt cap. Mirrors
/// `EntryAIGeneratorTests`, which covers the same machinery for entry AI.
@MainActor
final class EntryMapGenerationTests: XCTestCase {

    override func setUp() { super.setUp(); DevFlags.aiModel1 = true }
    override func tearDown() { DevFlags.aiModel1 = false; super.tearDown() }

    /// A minimal AIService that records map calls and can delay / throw.
    private final class SpyAI: AIService {
        private(set) var generateEntryMapCalls: [String] = []
        var delayNanos: UInt64 = 0
        var errorToThrow: Error?
        var map = CognitiveMapGeneration(
            map: CognitiveMap(
                v: 1,
                beats: [Beat(id: "b0", tier: .map, kind: .event, text: "Signed up",
                             quote: "Signed up.", quoteStart: 0, domain: .craft,
                             isSpine: true, isKeeper: false, generality: 0.1,
                             keepScore: 0.2, degree: 0, mentions: [])],
                edges: []
            ),
            model: "m"
        )

        func generateEntryMap(journalId: String) async throws -> CognitiveMapGeneration {
            generateEntryMapCalls.append(journalId)
            if delayNanos > 0 { try await Task.sleep(nanoseconds: delayNanos) }
            if let errorToThrow { throw errorToThrow }
            return map
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

    private func entry(
        id: String,
        content: String = "Only three people signed up for the beta today.",
        cognitiveMap: CognitiveMapGeneration? = nil,
        contentEditedAt: Date? = nil,
        createdAt: Date = Date()
    ) -> JournalEntry {
        JournalEntry(id: id, userId: "u", type: .text, title: "t",
                     createdAt: createdAt, content: content,
                     contentEditedAt: contentEditedAt, cognitiveMap: cognitiveMap)
    }

    private func storedMap(_ journals: MockJournalRepository, _ id: String) async -> CognitiveMapGeneration? {
        (try? await journals.fetchAllEntries())?.first { $0.id == id }?.cognitiveMap
    }

    // MARK: - ensureMap

    func testGeneratesAndPersistsAMap() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        let did = await gen.ensureMap(for: "e1")

        XCTAssertTrue(did)
        XCTAssertEqual(ai.generateEntryMapCalls, ["e1"])
        let stored = await storedMap(journals, "e1")
        XCTAssertEqual(stored?.map.beats.first?.text, "Signed up")
    }

    func testSkipsAnEntryThatAlreadyHasAFreshMap() async {
        let existing = CognitiveMapGeneration(
            map: CognitiveMap(v: 1, beats: [], edges: []), generatedAt: Date()
        )
        let journals = MockJournalRepository(entries: [entry(id: "e1", cognitiveMap: existing)])
        let ai = SpyAI()

        let did = await EntryAIGenerator(journals: journals, ai: ai).ensureMap(for: "e1")

        XCTAssertFalse(did)
        XCTAssertTrue(ai.generateEntryMapCalls.isEmpty)
    }

    func testRegeneratesWhenTheEntryWasEditedAfterMapping() async {
        let stale = CognitiveMapGeneration(
            map: CognitiveMap(v: 1, beats: [], edges: []),
            generatedAt: Date(timeIntervalSince1970: 1_000)
        )
        let journals = MockJournalRepository(entries: [
            entry(id: "e1", cognitiveMap: stale, contentEditedAt: Date(timeIntervalSince1970: 2_000)),
        ])
        let ai = SpyAI()

        _ = await EntryAIGenerator(journals: journals, ai: ai).ensureMap(for: "e1")

        XCTAssertEqual(ai.generateEntryMapCalls, ["e1"])
    }

    func testSkipsAnEmptyEntry() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1", content: "   ")])
        let ai = SpyAI()

        let did = await EntryAIGenerator(journals: journals, ai: ai).ensureMap(for: "e1")

        XCTAssertFalse(did)
        XCTAssertTrue(ai.generateEntryMapCalls.isEmpty)
    }

    func testDeDupesConcurrentCallsForTheSameEntry() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        ai.delayNanos = 50_000_000
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        // The exact race the in-flight claim exists to close: the at-save pipeline and
        // the launch sweep overlapping on one entry.
        async let first = gen.ensureMap(for: "e1")
        async let second = gen.ensureMap(for: "e1")
        let results = await [first, second]

        XCTAssertEqual(ai.generateEntryMapCalls.count, 1)
        XCTAssertEqual(results.filter { $0 }.count, 1)
    }

    func testDoesNotBlockEntryAIForTheSameEntry() async {
        // The in-flight keys are namespaced, so a map generation must not make the
        // entry-AI generation for the same entry bail out.
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        ai.delayNanos = 50_000_000
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        async let map = gen.ensureMap(for: "e1")
        async let aiRun = gen.ensureAI(for: "e1")
        _ = await [map, aiRun]

        XCTAssertEqual(ai.generateEntryMapCalls.count, 1)
    }

    func testStopsRetryingAfterTheSessionAttemptCap() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        ai.errorToThrow = URLError(.badServerResponse)
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        for _ in 0..<6 { _ = await gen.ensureMap(for: "e1") }

        XCTAssertEqual(ai.generateEntryMapCalls.count, 3)
    }

    func testCancellationDoesNotSpendAnAttempt() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        ai.errorToThrow = CancellationError()
        let gen = EntryAIGenerator(journals: journals, ai: ai)

        for _ in 0..<5 { _ = await gen.ensureMap(for: "e1") }

        XCTAssertEqual(ai.generateEntryMapCalls.count, 5)
    }

    func testAFailedMapDoesNotPersistAnything() async {
        let journals = MockJournalRepository(entries: [entry(id: "e1")])
        let ai = SpyAI()
        ai.errorToThrow = URLError(.timedOut)

        _ = await EntryAIGenerator(journals: journals, ai: ai).ensureMap(for: "e1")

        let stored = await storedMap(journals, "e1")
        XCTAssertNil(stored)
    }

    // MARK: - sweepMaps

    func testTheSweepBackfillsOnlyTheMostRecentEntries() async {
        // 25 entries, all needing a map. The sweep must stop at the backfill limit so a
        // large corpus does not fire dozens of model calls on first launch.
        let entries = (0..<25).map {
            entry(id: "e\($0)", createdAt: Date(timeIntervalSince1970: Double(1_000 + $0)))
        }
        let journals = MockJournalRepository(entries: entries)
        let ai = SpyAI()

        await EntryAIGenerator(journals: journals, ai: ai).sweepMaps()

        XCTAssertEqual(ai.generateEntryMapCalls.count, EntryAIGenerator.mapBackfillLimit)
    }

    func testTheSweepTakesTheNewestEntriesFirst() async {
        let entries = (0..<25).map {
            entry(id: "e\($0)", createdAt: Date(timeIntervalSince1970: Double(1_000 + $0)))
        }
        let journals = MockJournalRepository(entries: entries)
        let ai = SpyAI()

        await EntryAIGenerator(journals: journals, ai: ai).sweepMaps()

        // e24 is the newest, so it must be in the backfilled set and e0 must not.
        XCTAssertTrue(ai.generateEntryMapCalls.contains("e24"))
        XCTAssertFalse(ai.generateEntryMapCalls.contains("e0"))
    }

    func testTheSweepSkipsEntriesThatAlreadyHaveAMap() async {
        let mapped = CognitiveMapGeneration(
            map: CognitiveMap(v: 1, beats: [], edges: []), generatedAt: Date()
        )
        let journals = MockJournalRepository(entries: [
            entry(id: "e1", cognitiveMap: mapped),
            entry(id: "e2"),
        ])
        let ai = SpyAI()

        await EntryAIGenerator(journals: journals, ai: ai).sweepMaps()

        XCTAssertEqual(ai.generateEntryMapCalls, ["e2"])
    }
}
