import XCTest
@testable import LuminaLog

/// Fixed-token provider so `ProxyAPIClient` can build authed requests offline.
private final class VCCBStubTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

/// `SemanticIndexCoordinating` stand-in whose `search` never resolves within the
/// test's lifetime: standing in for a stalled/slow `/v1/rag/search` round trip
/// (server cold start, poor cellular connectivity, etc).
private final class HangingSearcher: SemanticIndexCoordinating {
    func indexEntry(id: String, text: String, createdAt: Date) async throws {}
    func removeEntry(id: String) async throws {}
    func backfill(_ entries: [(id: String, text: String, createdAt: Date)]) async throws {}
    func search(query: String, k: Int) async throws -> [String] {
        try await Task.sleep(nanoseconds: 10_000_000_000) // far longer than any acceptable budget
        return []
    }
}

/// Regression coverage for the "chat/call with this entry has no context" bug:
/// `voiceCallContext` bundles a fast, local-only focal-entry lookup together with a
/// network round trip (`coordinator.search`) that ranks PAST entries for RAG. Before
/// the fix, a stalled search blocked the whole function, and `VapiVoiceCallService`'s
/// outer 3s all-or-nothing timeout then discarded the ALREADY-COMPUTED focal entry
/// along with the slow RAG context. The focal entry must survive a hung search.
@MainActor
final class VoiceCallContextBudgetTests: XCTestCase {

    private var savedFlag = false

    override func setUp() {
        super.setUp()
        savedFlag = DevFlags.aiModel1
        DevFlags.aiModel1 = true
    }

    override func tearDown() {
        DevFlags.aiModel1 = savedFlag
        super.tearDown()
    }

    func testFocalEntryIsReturnedPromptlyEvenWhenSemanticSearchHangs() async throws {
        let focal = JournalEntry(
            id: "today-1", userId: "u1", type: .text, title: "Morning Pages",
            createdAt: Date(), content: "Today I decided to finally ship the thing."
        )
        let api = ProxyAPIClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: VCCBStubTokenProvider(),
            session: URLSession(configuration: .ephemeral)
        )
        let service = ProxyAIService(
            api: api,
            journals: MockJournalRepository(entries: [focal]),
            profiles: MockProfileRepository(),
            coordinator: HangingSearcher()
        )

        let start = Date()
        let context = try await service.voiceCallContext(journalId: focal.id)
        let elapsed = Date().timeIntervalSince(start)

        XCTAssertLessThan(
            elapsed, 3,
            "a hung past-entries semantic search must not block context assembly for as long as the outer call-start timeout"
        )
        XCTAssertEqual(
            context?.focalEntry, focal.content,
            "the focal entry (fast, local, no network needed) must survive a stalled RAG search"
        )
    }
}
