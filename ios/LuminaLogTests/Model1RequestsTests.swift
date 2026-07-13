import XCTest
@testable import LuminaLog

/// A ML-free, network-free stand-in for the semantic index used to drive the
/// `journalContext` semantic overload down each path (hits / empty / throwing).
private final class FakeSearcher: SemanticIndexCoordinating {
    var hits: [String]
    var shouldThrow: Bool
    private(set) var searchCalled = false

    init(hits: [String] = [], shouldThrow: Bool = false) {
        self.hits = hits
        self.shouldThrow = shouldThrow
    }

    func indexEntry(id: String, text: String) async throws {}
    func removeEntry(id: String) async throws {}
    func loadIndex() async throws {}
    func backfill(_ entries: [(id: String, text: String)]) async throws {}
    func search(query: String, k: Int) async throws -> [String] {
        searchCalled = true
        if shouldThrow { throw SemanticIndexError.keyUnavailable }
        return hits
    }
}

/// Unit tests for the pure Model-1 (zero-knowledge) request-body assembly
/// (increment 1c-C). These verify that, given decrypted plaintext inputs, the
/// bodies carry the exact PLAINTEXT fields the server's Model-1 branches expect.
final class Model1RequestsTests: XCTestCase {

    /// Fixed reference "now" so recency-driven ordering is deterministic.
    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    private func entry(
        id: String,
        type: JournalType = .text,
        title: String = "",
        content: String = "",
        daysAgo: Double = 0
    ) -> JournalEntry {
        JournalEntry(
            id: id,
            userId: "u1",
            type: type,
            title: title,
            createdAt: now.addingTimeInterval(-daysAgo * 86_400),
            content: content
        )
    }

    /// Encode any Encodable to a `[String: Any]` for field assertions.
    private func json(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    // MARK: - Profile fields

    func testProfileFieldsIncludesOnlyNonEmptyTrimmedValues() {
        let details = UserProfile.ProfileDetails(
            goals: "  run a marathon  ",   // trimmed
            hobbies: "",                    // empty → omitted
            age: "34",
            gender: "   ",                  // whitespace → omitted
            work: nil                       // nil → omitted
        )
        let fields = Model1Requests.profileFields(from: details)
        XCTAssertEqual(fields["goals"], "run a marathon")
        XCTAssertEqual(fields["age"], "34")
        XCTAssertNil(fields["hobbies"])
        XCTAssertNil(fields["gender"])
        XCTAssertNil(fields["work"])
        XCTAssertEqual(fields.count, 2)
    }

    // MARK: - Chat body

    func testChatBodyCarriesAllPlaintextContextFields() throws {
        let body = Model1Requests.ChatBody(
            chatId: "c1",
            message: "How was my week?",
            name: "Ada Lovelace",
            bio: "I write about analytical engines.",
            profile: ["goals": "finish the notes"],
            history: [
                .init(role: "user", content: "hi"),
                .init(role: "assistant", content: "hello"),
            ],
            journalContext: "[#1 — text · Notes · 2026-01-01]\nsome context",
            focalEntry: "the focal entry text"
        )
        let dict = try json(body)
        XCTAssertEqual(dict["chatId"] as? String, "c1")
        XCTAssertEqual(dict["message"] as? String, "How was my week?")
        XCTAssertEqual(dict["name"] as? String, "Ada Lovelace")
        XCTAssertEqual(dict["bio"] as? String, "I write about analytical engines.")
        XCTAssertEqual((dict["profile"] as? [String: Any])?["goals"] as? String, "finish the notes")
        XCTAssertEqual(dict["journalContext"] as? String, "[#1 — text · Notes · 2026-01-01]\nsome context")
        XCTAssertEqual(dict["focalEntry"] as? String, "the focal entry text")
        // The presence of `history` is the server's Model-1 trigger.
        let history = try XCTUnwrap(dict["history"] as? [[String: Any]])
        XCTAssertEqual(history.count, 2)
        XCTAssertEqual(history.first?["role"] as? String, "user")
        XCTAssertEqual(history.first?["content"] as? String, "hi")
    }

    // MARK: - History turns

    func testHistoryTurnsDropsTrailingJustSentUserMessage() {
        let messages = [
            ChatMessage(role: .user, text: "earlier"),
            ChatMessage(role: .assistant, text: "reply"),
            ChatMessage(role: .user, text: "current"),   // just persisted by the VM
        ]
        let turns = Model1Requests.historyTurns(from: messages, excludingLatest: "current")
        XCTAssertEqual(turns.map(\.content), ["earlier", "reply"])
        XCTAssertEqual(turns.map(\.role), ["user", "assistant"])
    }

    func testHistoryTurnsKeepsTrailingUserMessageWhenNotTheJustSentOne() {
        let messages = [
            ChatMessage(role: .assistant, text: "reply"),
            ChatMessage(role: .user, text: "different"),
        ]
        let turns = Model1Requests.historyTurns(from: messages, excludingLatest: "current")
        XCTAssertEqual(turns.map(\.content), ["reply", "different"])
    }

    func testHistoryTurnsCapsAtLimit() {
        let messages = (0..<20).map { ChatMessage(role: .assistant, text: "m\($0)") }
        let turns = Model1Requests.historyTurns(from: messages, excludingLatest: nil, limit: 10)
        XCTAssertEqual(turns.count, 10)
        // suffix — the last 10.
        XCTAssertEqual(turns.first?.content, "m10")
        XCTAssertEqual(turns.last?.content, "m19")
    }

    // MARK: - Journal context (client-side RAG string)

    func testJournalContextFormatsTopKInServerShape() {
        let a = entry(id: "a", type: .text, title: "Hiking", content: "went hiking today", daysAgo: 1)
        let b = entry(id: "b", type: .voice, title: "Cooking", content: "made pasta", daysAgo: 2)
        let context = Model1Requests.journalContext(
            from: [a, b], query: "hiking", now: now, topK: 5
        )
        // Best match first, server format: `[#1 — type · title · date]\n<snippet>`.
        let date = Model1Requests.dayFormatter.string(from: a.createdAt)
        XCTAssertTrue(context.hasPrefix("[#1 — text · Hiking · \(date)]\nwent hiking today"),
                      "Unexpected context:\n\(context)")
    }

    func testFormatDateTimeLocalTagsLocalTimestampAndHumanType() {
        // The voice path renders a local date+TIME stamp and a human type label so the
        // assistant can reason about when/how each entry was made.
        let e = entry(id: "h", type: .image, title: "Morning pages", content: "handwritten thoughts")
        let tz = TimeZone(identifier: "America/Los_Angeles")!
        let context = Model1Requests.format([e], snippetChars: 500, dateStyle: .dateTimeLocal, timeZone: tz)
        let stamp = Model1Requests.dateTimeFormatter(tz).string(from: e.createdAt)
        XCTAssertEqual(context, "[#1 — handwritten image · Morning pages · \(stamp)]\nhandwritten thoughts")
        XCTAssertTrue(stamp.contains(":"), "expected an HH:mm time component in \(stamp)")
    }

    func testTypeLabelMapsImageToHandwritten() {
        XCTAssertEqual(Model1Requests.typeLabel(.text), "text")
        XCTAssertEqual(Model1Requests.typeLabel(.voice), "voice")
        XCTAssertEqual(Model1Requests.typeLabel(.video), "video")
        XCTAssertEqual(Model1Requests.typeLabel(.image), "handwritten image")
    }

    func testJournalContextRespectsTopK() {
        let entries = (0..<5).map { entry(id: "e\($0)", content: "shared term", daysAgo: Double($0)) }
        let context = Model1Requests.journalContext(from: entries, query: "shared", now: now, topK: 2)
        // Exactly two blocks → exactly one block separator.
        let blocks = context.components(separatedBy: "\n\n")
        XCTAssertEqual(blocks.count, 2)
        XCTAssertTrue(context.contains("[#1 —"))
        XCTAssertTrue(context.contains("[#2 —"))
        XCTAssertFalse(context.contains("[#3 —"))
    }

    func testJournalContextEmptyWhenNoEntries() {
        XCTAssertEqual(Model1Requests.journalContext(from: [], query: "x", now: now), "")
    }

    func testJournalContextTitlesUntitledWhenBlank() {
        let e = entry(id: "e", title: "", content: "body text")
        let context = Model1Requests.journalContext(from: [e], query: "", now: now)
        XCTAssertTrue(context.contains("· Untitled ·"), context)
    }

    // MARK: - Journal context (semantic overload, 1c-D / 19b)

    /// With a searcher that returns hits, the context is built from the SEMANTIC
    /// ranking — in the searcher's order — not the keyword ranking. Here the
    /// keyword path would rank "alpha" first, but the searcher returns c then b, so
    /// the semantic path must win (proving which path ran).
    func testJournalContextSemanticUsesSearcherRankingOverKeyword() async {
        let a = entry(id: "a", title: "alpha", content: "alpha alpha alpha", daysAgo: 1)
        let b = entry(id: "b", title: "Beta", content: "beta body", daysAgo: 2)
        let c = entry(id: "c", title: "Gamma", content: "gamma body", daysAgo: 3)
        let searcher = FakeSearcher(hits: ["c", "b"])

        let context = await Model1Requests.journalContext(
            from: [a, b, c], query: "alpha", now: now, searcher: searcher
        )

        XCTAssertTrue(searcher.searchCalled)
        // Semantic order: #1 c, #2 b; keyword-favored "alpha" is absent.
        XCTAssertTrue(context.hasPrefix("[#1 — text · Gamma · "), context)
        XCTAssertTrue(context.contains("[#2 — text · Beta · "), context)
        XCTAssertFalse(context.contains("alpha"), context)
    }

    /// Ids the searcher returns that don't resolve to a supplied entry are skipped;
    /// the remaining resolved ids still build the context (no crash, no fallback if
    /// at least one resolves).
    func testJournalContextSemanticSkipsUnknownIds() async {
        let c = entry(id: "c", title: "Gamma", content: "gamma body")
        let searcher = FakeSearcher(hits: ["missing", "c"])
        let context = await Model1Requests.journalContext(
            from: [c], query: "x", now: now, searcher: searcher
        )
        XCTAssertTrue(context.hasPrefix("[#1 — text · Gamma · "), context)
    }

    /// An empty searcher result falls back to the keyword path — output is
    /// byte-identical to the pure keyword function.
    func testJournalContextFallsBackToKeywordWhenSearcherEmpty() async {
        let a = entry(id: "a", title: "Hiking", content: "went hiking today", daysAgo: 1)
        let b = entry(id: "b", title: "Cooking", content: "made pasta", daysAgo: 2)
        let searcher = FakeSearcher(hits: [])

        let semantic = await Model1Requests.journalContext(
            from: [a, b], query: "hiking", now: now, searcher: searcher
        )
        let keyword = Model1Requests.journalContext(from: [a, b], query: "hiking", now: now)

        XCTAssertTrue(searcher.searchCalled)
        XCTAssertEqual(semantic, keyword)
    }

    /// A throwing searcher falls back to the keyword path (never worse than today).
    func testJournalContextFallsBackToKeywordWhenSearcherThrows() async {
        let a = entry(id: "a", title: "Hiking", content: "went hiking today", daysAgo: 1)
        let b = entry(id: "b", title: "Cooking", content: "made pasta", daysAgo: 2)
        let searcher = FakeSearcher(hits: ["a"], shouldThrow: true)

        let semantic = await Model1Requests.journalContext(
            from: [a, b], query: "hiking", now: now, searcher: searcher
        )
        let keyword = Model1Requests.journalContext(from: [a, b], query: "hiking", now: now)

        XCTAssertTrue(searcher.searchCalled)
        XCTAssertEqual(semantic, keyword)
    }

    /// A nil searcher (the flag-OFF / mock-wiring shape) is exactly the keyword
    /// path — byte-identical to the legacy sync function.
    func testJournalContextNilSearcherIsKeywordPath() async {
        let a = entry(id: "a", title: "Hiking", content: "went hiking today", daysAgo: 1)
        let b = entry(id: "b", title: "Cooking", content: "made pasta", daysAgo: 2)

        let semantic = await Model1Requests.journalContext(
            from: [a, b], query: "hiking", now: now, searcher: nil
        )
        let keyword = Model1Requests.journalContext(from: [a, b], query: "hiking", now: now)
        XCTAssertEqual(semantic, keyword)
    }

    // MARK: - Daily-prompt body

    func testDailyPromptBodyProjectsRecentEntries() throws {
        let entries = [
            entry(id: "e1", type: .text, title: "Day one", content: "first"),
            entry(id: "e2", type: .voice, title: "", content: "second"),
        ]
        let body = Model1Requests.DailyPromptBody(
            name: "Grace",
            profile: ["hobbies": "sailing"],
            entries: Model1Requests.promptEntries(from: entries)
        )
        let dict = try json(body)
        XCTAssertEqual(dict["name"] as? String, "Grace")
        let arr = try XCTUnwrap(dict["entries"] as? [[String: Any]])
        XCTAssertEqual(arr.count, 2)
        XCTAssertEqual(arr[0]["id"] as? String, "e1")
        XCTAssertEqual(arr[0]["type"] as? String, "text")
        XCTAssertEqual(arr[0]["title"] as? String, "Day one")
        XCTAssertEqual(arr[0]["content"] as? String, "first")
        XCTAssertEqual(arr[1]["title"] as? String, "Untitled") // blank → Untitled
    }

    func testPromptEntriesCapsAtLimit() {
        let entries = (0..<10).map { entry(id: "e\($0)", content: "c") }
        XCTAssertEqual(Model1Requests.promptEntries(from: entries, limit: 5).count, 5)
    }

    // MARK: - Summary body

    func testSummaryBodyCarriesPlaintextContentAndType() throws {
        let body = Model1Requests.SummaryBody(journalId: "j1", content: "the plaintext", type: "voice")
        let dict = try json(body)
        XCTAssertEqual(dict["journalId"] as? String, "j1")
        XCTAssertEqual(dict["content"] as? String, "the plaintext")
        XCTAssertEqual(dict["type"] as? String, "voice")
    }

    // MARK: - Daily-report body

    func testDailyReportBodyCarriesTodayTextAndSources() throws {
        let body = Model1Requests.DailyReportBody(
            date: "2026-07-09", force: true, name: "Alan",
            todayText: "today I wrote a lot",
            relatedContext: "[#1 — text · Past · 2026-01-01]\nold",
            sourceEntryIds: ["e1", "e2"]
        )
        let dict = try json(body)
        XCTAssertEqual(dict["todayText"] as? String, "today I wrote a lot")
        XCTAssertEqual(dict["relatedContext"] as? String, "[#1 — text · Past · 2026-01-01]\nold")
        XCTAssertEqual(dict["sourceEntryIds"] as? [String], ["e1", "e2"])
        XCTAssertEqual(dict["name"] as? String, "Alan")
        XCTAssertEqual(dict["force"] as? Bool, true)
    }
}
