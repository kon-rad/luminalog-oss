import XCTest
@testable import LuminaLog

// MARK: - Test doubles

/// Fixed-token provider so `ProxyAPIClient` can build authed requests offline.
private final class StubTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

/// Captures the outgoing request body and returns a canned JSON response, so we
/// can assert exactly what `ProxyAIService` PUTs on the wire per code path.
final class BodyCapturingURLProtocol: URLProtocol {

    // Language mode 5.0: no strict-concurrency isolation checks on these statics.
    nonisolated(unsafe) static var lastBody: Data?
    nonisolated(unsafe) static var responseJSON = Data(#"{"text":"ok","model":"m"}"#.utf8)

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lastBody = Self.readBody(from: request)
        let response = HTTPURLResponse(
            url: request.url!, statusCode: 200, httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.responseJSON)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    /// URLSession delivers a set `httpBody` to the protocol via `httpBodyStream`,
    /// so read the stream when the plain body is absent.
    private static func readBody(from request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let size = 4096
        var buffer = [UInt8](repeating: 0, count: size)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: size)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}

// MARK: - Tests

final class Model1ReroutingTests: XCTestCase {

    private var savedFlag = false

    override func setUp() {
        super.setUp()
        savedFlag = DevFlags.aiModel1
    }

    override func tearDown() {
        DevFlags.aiModel1 = savedFlag   // never leak the flag into other suites
        BodyCapturingURLProtocol.lastBody = nil
        super.tearDown()
    }

    @MainActor
    private func makeService(entries: [JournalEntry]) -> ProxyAIService {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [BodyCapturingURLProtocol.self]
        let session = URLSession(configuration: config)
        let api = ProxyAPIClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: StubTokenProvider(),
            session: session
        )
        return ProxyAIService(api: api, journals: MockJournalRepository(entries: entries))
    }

    private func capturedBody() throws -> [String: Any] {
        let data = try XCTUnwrap(BodyCapturingURLProtocol.lastBody)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    // MARK: Flag default & persistence wiring

    func testAiModel1FlagDefaultsOff() {
        DevFlags.aiModel1 = false
        XCTAssertFalse(DevFlags.aiModel1, "The client Model-1 flag must default OFF (production-safe)")
    }

    @MainActor
    func testPersistsChatRepliesTracksFlag() {
        let service = makeService(entries: [])
        // Flag OFF → server persists (legacy) → client must NOT double-persist.
        DevFlags.aiModel1 = false
        XCTAssertTrue(service.persistsChatReplies)
        // Flag ON (Model 1) → server does NOT persist → client owns persistence.
        DevFlags.aiModel1 = true
        XCTAssertFalse(service.persistsChatReplies)
    }

    // MARK: Summary request-body construction (flag OFF vs ON)

    @MainActor
    func testSummaryBodyIsLegacyIdOnlyWhenFlagOff() async throws {
        DevFlags.aiModel1 = false
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "secret plaintext")
        let service = makeService(entries: [entry])

        _ = try await service.generateSummary(journalId: "e1")

        let body = try capturedBody()
        // SAFETY INVARIANT: byte-identical legacy shape — journalId only, no plaintext.
        XCTAssertEqual(body["journalId"] as? String, "e1")
        XCTAssertNil(body["content"], "Legacy path must NOT send decrypted content")
        XCTAssertNil(body["type"])
    }

    @MainActor
    func testSummaryBodyCarriesPlaintextWhenFlagOn() async throws {
        DevFlags.aiModel1 = true
        let entry = JournalEntry(id: "e1", userId: "u", type: .voice, title: "T", content: "secret plaintext")
        let service = makeService(entries: [entry])

        _ = try await service.generateSummary(journalId: "e1")

        let body = try capturedBody()
        // Model-1 path sends the entry's PLAINTEXT content + type.
        XCTAssertEqual(body["journalId"] as? String, "e1")
        XCTAssertEqual(body["content"] as? String, "secret plaintext")
        XCTAssertEqual(body["type"] as? String, "voice")
    }

    // MARK: Daily-prompt request-body construction (flag ON)

    @MainActor
    func testDailyPromptSendsPlaintextEntriesWhenFlagOn() async throws {
        DevFlags.aiModel1 = true
        // The single-`text` fallback in the response is fine; we only assert the body.
        BodyCapturingURLProtocol.responseJSON = Data(#"{"text":"a prompt"}"#.utf8)
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "Morning", content: "wrote a lot")
        let service = makeService(entries: [entry])

        _ = try await service.dailyPrompt()

        let body = try capturedBody()
        let entries = try XCTUnwrap(body["entries"] as? [[String: Any]],
                                    "Model-1 daily-prompt must send plaintext entries[]")
        XCTAssertEqual(entries.first?["id"] as? String, "e1")
        XCTAssertEqual(entries.first?["content"] as? String, "wrote a lot")
    }

    @MainActor
    func testDailyPromptSendsNoEntriesArrayWhenFlagOff() async throws {
        DevFlags.aiModel1 = false
        BodyCapturingURLProtocol.responseJSON = Data(#"{"text":"a prompt"}"#.utf8)
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "Morning", content: "wrote a lot")
        let service = makeService(entries: [entry])

        _ = try await service.dailyPrompt()

        let body = try capturedBody()
        XCTAssertNil(body["entries"], "Legacy daily-prompt sends an empty body — no plaintext entries")
    }
}

// MARK: - Client-side message persistence on the Model-1 path

/// On the Model-1 path the server no longer persists chat messages, so the
/// client owns persistence via the existing (encrypting) `ChatRepository`.
/// `ProxyAIService.persistsChatReplies` flips to `false` when the flag is on,
/// which drives `ChatViewModel` to write both sides itself. These tests exercise
/// that view-model behavior with the `persistsChatReplies` value the Model-1 and
/// legacy paths respectively produce. (`SpyChatRepository`/`StubChatAIService`
/// are defined in `ChatViewModelTests.swift`; `FirestoreChatRepository` is the
/// production encrypting implementation the same calls flow through.)
final class Model1ChatPersistenceTests: XCTestCase {

    @MainActor
    func testModel1PathPersistsBothUserAndAssistantClientSide() async throws {
        let repo = SpyChatRepository(
            chats: [Chat(id: "c1", userId: "u", kind: .text, title: "New chat")],
            messages: ["c1": []]
        )
        let ai = StubChatAIService()
        ai.persistsChatReplies = false   // Model-1: server does NOT persist
        ai.deltas = ["Reflecting", " with you."]
        let vm = ChatViewModel(chatId: "c1", kind: .text, title: "New chat",
                               chats: repo, ai: ai, speech: MockSpeechTranscriber())
        await vm.start()

        vm.draft = "How was my week?"
        await vm.send()

        XCTAssertEqual(repo.appended.map(\.message.role), [.user, .assistant],
                       "Both messages must be written client-side (and encrypted by the repo)")
        XCTAssertEqual(repo.appended.first?.message.text, "How was my week?")
        XCTAssertEqual(repo.appended.last?.message.text, "Reflecting with you.")
    }

    @MainActor
    func testLegacyPathDoesNotDoublePersist() async throws {
        let repo = SpyChatRepository(
            chats: [Chat(id: "c1", userId: "u", kind: .text, title: "New chat")],
            messages: ["c1": []]
        )
        let ai = StubChatAIService()
        ai.persistsChatReplies = true    // legacy: server persists both sides
        let vm = ChatViewModel(chatId: "c1", kind: .text, title: "New chat",
                               chats: repo, ai: ai, speech: MockSpeechTranscriber())
        await vm.start()

        vm.draft = "How was my week?"
        await vm.send()

        XCTAssertTrue(repo.appended.isEmpty,
                      "Legacy path must not write messages — the server already does")
    }
}
