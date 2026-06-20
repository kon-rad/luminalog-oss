import XCTest
@testable import LuminaLog

// MARK: - Shared spies

/// `ChatRepository` spy that delegates to an in-memory `MockChatRepository`
/// while recording calls and supporting failure injection. Shared by the
/// chat view-model test suites.
@MainActor
final class SpyChatRepository: ChatRepository {

    struct SpyError: Error {}

    private let backing: MockChatRepository

    private(set) var appended: [(chatId: String, message: ChatMessage)] = []
    private(set) var titleUpdates: [(id: String, title: String)] = []
    private(set) var deletedIds: [String] = []
    private(set) var createdKinds: [ChatKind] = []

    /// When true, the next `appendMessage` throws (then auto-resets).
    var failNextAppend = false

    init(
        chats: [Chat] = [],
        messages: [String: [ChatMessage]] = [:]
    ) {
        backing = MockChatRepository(chats: chats, messages: messages)
    }

    func chats() -> AsyncStream<[Chat]> { backing.chats() }

    func messages(chatId: String) -> AsyncStream<[ChatMessage]> {
        backing.messages(chatId: chatId)
    }

    func createChat(kind: ChatKind, title: String) async throws -> Chat {
        createdKinds.append(kind)
        return try await backing.createChat(kind: kind, title: title)
    }

    func appendMessage(_ message: ChatMessage, to chatId: String) async throws {
        if failNextAppend {
            failNextAppend = false
            throw SpyError()
        }
        appended.append((chatId, message))
        try await backing.appendMessage(message, to: chatId)
    }

    func updateChatTitle(id: String, title: String) async throws {
        titleUpdates.append((id, title))
        try await backing.updateChatTitle(id: id, title: title)
    }

    /// Simulates a server-side write (e.g. the proxy persisting a message)
    /// landing via the live stream, without counting as a client `append`.
    func simulateServerWrite(_ message: ChatMessage, to chatId: String) async throws {
        try await backing.appendMessage(message, to: chatId)
    }

    func deleteChat(id: String) async throws {
        deletedIds.append(id)
        try await backing.deleteChat(id: id)
    }
}

/// `AIService` stub whose chat stream yields scripted deltas, optionally
/// failing after N deltas. Other AI methods are unused by these tests.
@MainActor
final class StubChatAIService: AIService {

    struct StreamError: Error {}

    var deltas: [String] = ["Hello", " there."]
    /// Throw after yielding this many deltas (0 = fail immediately).
    var failAfter: Int?
    /// Mirrors the production proxy: when true the service is treated as the
    /// sole persister, so the view model must not append messages itself.
    var persistsChatReplies = false
    private(set) var streamCalls = 0
    /// Captured continuation when `manualStreaming` is true — the test
    /// drives the stream by hand to observe partial accumulation.
    var manualStreaming = false
    private(set) var continuation: AsyncThrowingStream<String, Error>.Continuation?

    func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
        streamCalls += 1
        if manualStreaming {
            return AsyncThrowingStream { self.continuation = $0 }
        }
        let deltas = deltas
        let failAfter = failAfter
        return AsyncThrowingStream { continuation in
            for (index, delta) in deltas.enumerated() {
                if let failAfter, index >= failAfter {
                    continuation.finish(throwing: StreamError())
                    return
                }
                continuation.yield(delta)
            }
            if let failAfter, failAfter >= deltas.count {
                continuation.finish(throwing: StreamError())
            } else {
                continuation.finish()
            }
        }
    }

    func generateSummary(journalId: String) async throws -> AIGeneration {
        AIGeneration(text: "", model: "stub")
    }

    func generateInsights(journalId: String) async throws -> AIGeneration {
        AIGeneration(text: "", model: "stub")
    }

    func generatePrompts(journalId: String) async throws -> [String] { [] }

    func dailyPrompt() async throws -> String { "" }

    func requestIndex(journalId: String) async {}
    func deleteEntry(journalId: String) async throws {}

    func transcribeJournal(journalId: String) async {}

    func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
    func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
    func searchKeyword(query: String) async throws -> [SearchResult] { [] }
    func searchSemantic(query: String) async throws -> [SearchResult] { [] }
    func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
}

// MARK: - Test helpers

@MainActor
func waitUntil(
    timeout: TimeInterval = 2,
    _ condition: @MainActor () -> Bool
) async throws {
    let deadline = Date().addingTimeInterval(timeout)
    while !condition() {
        guard Date() < deadline else {
            XCTFail("Timed out waiting for condition")
            return
        }
        try await Task.sleep(nanoseconds: 2_000_000)
    }
}

// MARK: - ChatViewModelTests

final class ChatViewModelTests: XCTestCase {

    @MainActor
    private func makeViewModel(
        repo: SpyChatRepository,
        ai: StubChatAIService,
        chatId: String = "chat-1",
        title: String = "New chat"
    ) -> ChatViewModel {
        ChatViewModel(
            chatId: chatId,
            kind: .text,
            title: title,
            chats: repo,
            ai: ai,
            speech: MockSpeechTranscriber()
        )
    }

    @MainActor
    private func makeRepo(
        chatId: String = "chat-1",
        messages: [ChatMessage] = []
    ) -> SpyChatRepository {
        SpyChatRepository(
            chats: [Chat(id: chatId, userId: "u", kind: .text, title: "New chat")],
            messages: [chatId: messages]
        )
    }

    // MARK: Send pipeline

    @MainActor
    func testSendPersistsUserThenAssistantAfterStreamCompletes() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        ai.deltas = ["You protected", " your mornings."]
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        viewModel.draft = "How was my week?"
        await viewModel.send()

        XCTAssertEqual(repo.appended.map(\.message.role), [.user, .assistant])
        XCTAssertEqual(repo.appended.first?.message.text, "How was my week?")
        XCTAssertEqual(repo.appended.last?.message.text, "You protected your mornings.")
        XCTAssertNil(viewModel.streamingReply, "Transient streaming text clears on completion")
        XCTAssertFalse(viewModel.isAwaitingFirstToken)
        XCTAssertEqual(viewModel.draft, "", "Draft clears optimistically")

        // The live stream mirrors both persisted messages.
        try await waitUntil { viewModel.messages.count == 2 }
    }

    @MainActor
    func testStreamingPartialAccumulatesDeltas() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        ai.manualStreaming = true
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        viewModel.draft = "Hi"
        let sendTask = Task { await viewModel.send() }

        try await waitUntil { ai.continuation != nil }
        XCTAssertTrue(viewModel.isAwaitingFirstToken, "Typing dots until the first token")

        ai.continuation?.yield("Read")
        try await waitUntil { viewModel.streamingReply == "Read" }
        XCTAssertFalse(viewModel.isAwaitingFirstToken)

        ai.continuation?.yield("ing along")
        try await waitUntil { viewModel.streamingReply == "Reading along" }

        ai.continuation?.finish()
        await sendTask.value

        XCTAssertNil(viewModel.streamingReply)
        XCTAssertEqual(repo.appended.last?.message.text, "Reading along")
        XCTAssertEqual(repo.appended.last?.message.role, .assistant)
    }

    // MARK: Server-side persistence (no client double-write)

    @MainActor
    func testServerPersistedRepliesAreNotWrittenByClient() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        ai.persistsChatReplies = true
        ai.deltas = ["You protected", " your mornings."]
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        viewModel.draft = "How was my week?"
        await viewModel.send()

        // The proxy already persists both sides server-side; writing them
        // again here is exactly the doubling bug we are preventing.
        XCTAssertTrue(repo.appended.isEmpty, "Client must not persist when the proxy already does")
        XCTAssertEqual(ai.streamCalls, 1)
        XCTAssertNil(viewModel.streamingReply)
        XCTAssertFalse(viewModel.isAwaitingFirstToken)
        XCTAssertEqual(viewModel.draft, "", "Draft still clears optimistically")
        // Optimistic bubble stands in until the server's copy streams back.
        XCTAssertEqual(viewModel.pendingUserMessage?.text, "How was my week?")
        // Auto-titling stays a client responsibility — the proxy doesn't rename.
        XCTAssertEqual(repo.titleUpdates.first?.title, "How was my week?")
    }

    @MainActor
    func testOptimisticBubbleClearsWhenServerCopyArrives() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        ai.persistsChatReplies = true
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        viewModel.draft = "Hello server"
        await viewModel.send()
        XCTAssertEqual(viewModel.pendingUserMessage?.text, "Hello server")

        // The proxy's server-side write lands via the live stream.
        try await repo.simulateServerWrite(
            ChatMessage(role: .user, text: "Hello server"), to: "chat-1"
        )
        try await waitUntil { viewModel.pendingUserMessage == nil }
        XCTAssertEqual(viewModel.messages.map(\.text), ["Hello server"],
                       "Exactly one user message — no duplicate")
    }

    @MainActor
    func testServerPersistStreamFailureClearsOptimisticBubble() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        ai.persistsChatReplies = true
        ai.failAfter = 0
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        viewModel.draft = "Tough day."
        await viewModel.send()

        XCTAssertNil(viewModel.pendingUserMessage, "Optimistic bubble drops; Retry row takes over")
        XCTAssertEqual(viewModel.failedSend?.message.text, "Tough day.")
        XCTAssertTrue(repo.appended.isEmpty)
    }

    // MARK: Failure & retry

    @MainActor
    func testStreamFailureMarksFailedAndRetryResends() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        ai.failAfter = 0 // stream fails before any token
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        viewModel.draft = "Tough day."
        await viewModel.send()

        XCTAssertEqual(viewModel.failedSend?.message.text, "Tough day.")
        XCTAssertEqual(viewModel.failedSend?.isPersisted, true,
                       "User message reached the repository; only the stream failed")
        XCTAssertEqual(repo.appended.count, 1, "Only the user message was persisted")
        XCTAssertNil(viewModel.streamingReply)

        // Retry succeeds: stream re-runs, user message is NOT re-appended.
        ai.failAfter = nil
        ai.deltas = ["Better", " now."]
        await viewModel.retry()

        XCTAssertNil(viewModel.failedSend)
        XCTAssertEqual(ai.streamCalls, 2)
        XCTAssertEqual(repo.appended.count, 2, "Retry appends only the assistant reply")
        XCTAssertEqual(repo.appended.last?.message.text, "Better now.")
    }

    @MainActor
    func testAppendFailureMarksUnpersistedAndRetryReappends() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        repo.failNextAppend = true
        viewModel.draft = "Lost message"
        await viewModel.send()

        XCTAssertEqual(viewModel.failedSend?.isPersisted, false)
        XCTAssertEqual(repo.appended.count, 0)
        XCTAssertEqual(ai.streamCalls, 0, "No stream attempt when the append fails")

        await viewModel.retry()

        XCTAssertNil(viewModel.failedSend)
        XCTAssertEqual(repo.appended.map(\.message.role), [.user, .assistant])
        XCTAssertEqual(repo.appended.first?.message.text, "Lost message")
    }

    // MARK: Title

    @MainActor
    func testTitleUpdatesAfterFirstUserMessageOnly() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        let longText = "This is a very long first message that should definitely be truncated"
        viewModel.draft = longText
        await viewModel.send()

        XCTAssertEqual(repo.titleUpdates.count, 1)
        let title = try XCTUnwrap(repo.titleUpdates.first?.title)
        XCTAssertTrue(title.hasSuffix("…"))
        XCTAssertLessThanOrEqual(title.count, 41, "~40 chars plus ellipsis")
        XCTAssertTrue(longText.hasPrefix(String(title.dropLast()).trimmingCharacters(in: .whitespaces)))
        XCTAssertEqual(viewModel.title, title, "Nav title mirrors the rename")

        // Second message must not rename again.
        viewModel.draft = "And another thing."
        await viewModel.send()
        XCTAssertEqual(repo.titleUpdates.count, 1)
    }

    @MainActor
    func testShortFirstMessageBecomesTitleVerbatim() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        viewModel.draft = "Morning check-in"
        await viewModel.send()

        XCTAssertEqual(repo.titleUpdates.first?.title, "Morning check-in")
    }

    @MainActor
    func testExistingConversationDoesNotRename() async throws {
        let existing = [
            ChatMessage(role: .user, text: "Earlier message"),
            ChatMessage(role: .assistant, text: "Earlier reply")
        ]
        let repo = makeRepo(messages: existing)
        let ai = StubChatAIService()
        let viewModel = makeViewModel(repo: repo, ai: ai, title: "Processing the week")
        await viewModel.start()

        viewModel.draft = "Follow-up question"
        await viewModel.send()

        XCTAssertTrue(repo.titleUpdates.isEmpty)
        XCTAssertEqual(viewModel.title, "Processing the week")
    }

    // MARK: Read-only / greeting

    @MainActor
    func testReadOnlyVoiceTranscriptBlocksSending() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        let viewModel = ChatViewModel(
            chatId: "chat-1",
            kind: .voice,
            title: "Evening call",
            chats: repo,
            ai: ai,
            speech: MockSpeechTranscriber()
        )
        await viewModel.start()

        XCTAssertTrue(viewModel.isReadOnly)
        viewModel.draft = "Should not send"
        await viewModel.send()
        XCTAssertTrue(repo.appended.isEmpty)
        XCTAssertEqual(ai.streamCalls, 0)
    }

    @MainActor
    func testGreetingShowsOnlyForFreshTextChat() async throws {
        let repo = makeRepo()
        let ai = StubChatAIService()
        let viewModel = makeViewModel(repo: repo, ai: ai)
        await viewModel.start()

        XCTAssertTrue(viewModel.showsGreeting)

        viewModel.draft = "Hello"
        await viewModel.send()
        try await waitUntil { !viewModel.messages.isEmpty }
        XCTAssertFalse(viewModel.showsGreeting)
    }
}
