import XCTest
@testable import LuminaLog

final class MockVoiceCallServiceTests: XCTestCase {

    @MainActor
    private final class EventCollector {
        private(set) var events: [VoiceCallEvent] = []
        private var task: Task<Void, Never>?

        init(_ service: MockVoiceCallService) {
            let stream = service.events
            task = Task { [weak self] in
                for await event in stream {
                    self?.events.append(event)
                }
            }
        }

        var endedReason: String?? {
            for event in events {
                if case .ended(let reason) = event { return reason }
            }
            return nil
        }

        deinit { task?.cancel() }
    }

    @MainActor
    func testScriptedCallEmitsLifecycleAndPersistsTranscript() async throws {
        let repo = MockChatRepository(chats: [], messages: [:])
        let service = MockVoiceCallService(chats: repo, beatDelay: 1_000_000) // 1ms beats
        let chat = try await repo.createChat(kind: .voice, title: "Voice call")

        let collector = EventCollector(service)
        try await service.startCall(chatId: chat.id)

        try await waitUntil { collector.endedReason != nil }

        // Lifecycle starts connecting → connected.
        XCTAssertEqual(collector.events.first, .connecting)
        XCTAssertEqual(collector.events.dropFirst().first, .connected)
        XCTAssertTrue(collector.events.contains(.userSpeaking))
        XCTAssertTrue(collector.events.contains(.listening))

        // 3 exchanges → 6 finalized transcript messages, alternating roles,
        // persisted into the .voice chat via the repository.
        let transcriptEvents = collector.events.compactMap { event -> ChatMessage? in
            if case .transcriptUpdated(let message) = event { return message }
            return nil
        }
        XCTAssertEqual(transcriptEvents.count, 6)
        XCTAssertEqual(
            transcriptEvents.map(\.role),
            [.user, .assistant, .user, .assistant, .user, .assistant]
        )

        var persisted: [ChatMessage] = []
        for await first in repo.messages(chatId: chat.id) {
            persisted = first
            break
        }
        XCTAssertEqual(persisted, transcriptEvents, "Repository holds the same transcript")

        XCTAssertNotNil(collector.endedReason ?? nil, "Scripted calls end with a reason")
    }

    @MainActor
    func testEndCallCancelsScriptAndEmitsEnded() async throws {
        let repo = MockChatRepository(chats: [], messages: [:])
        // Long beats: the script barely advances before we hang up.
        let service = MockVoiceCallService(chats: repo, beatDelay: 1_000_000_000)
        let chat = try await repo.createChat(kind: .voice, title: "Voice call")

        let collector = EventCollector(service)
        try await service.startCall(chatId: chat.id)
        await service.endCall()

        try await waitUntil { collector.endedReason != nil }
        XCTAssertEqual(collector.events.first, .connecting)
        XCTAssertEqual(collector.endedReason, .some(nil), "User hang-up has no scripted reason")

        // A second endCall is a no-op (no duplicate ended events).
        await service.endCall()
        let endedCount = collector.events.filter {
            if case .ended = $0 { return true }
            return false
        }.count
        XCTAssertEqual(endedCount, 1)
    }

    @MainActor
    func testSetMutedTogglesFlag() {
        let service = MockVoiceCallService(chats: MockChatRepository())
        XCTAssertFalse(service.isMuted)
        service.setMuted(true)
        XCTAssertTrue(service.isMuted)
        service.setMuted(false)
        XCTAssertFalse(service.isMuted)
    }
}
