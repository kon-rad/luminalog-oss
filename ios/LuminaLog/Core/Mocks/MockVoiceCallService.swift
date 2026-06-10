import Foundation
import OSLog

/// Scripted `VoiceCallService` for demo mode, previews, and tests.
///
/// Plays a three-exchange conversation: connecting → connected → alternating
/// listening / userSpeaking / assistantSpeaking, emitting finalized
/// transcript messages along the way. Unlike production (where the Vapi
/// webhook persists transcripts server-side), the mock persists each
/// finalized message into the `.voice` chat via `ChatRepository` so the call
/// shows up in chat history immediately.
@MainActor
final class MockVoiceCallService: VoiceCallService {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "voice")

    private let chats: ChatRepository
    /// Nanoseconds per scripted beat — small in tests, ~1s in demo.
    private let beatDelay: UInt64
    private let broadcaster = VoiceCallEventBroadcaster()
    private var scriptTask: Task<Void, Never>?

    private(set) var isMuted = false

    init(chats: ChatRepository, beatDelay: UInt64 = 1_100_000_000) {
        self.chats = chats
        self.beatDelay = beatDelay
    }

    // MARK: - Script

    private static let script: [(user: String, assistant: String)] = [
        (
            user: "Hey. I've got a few minutes — can we talk through my day?",
            assistant: "Of course. You wrote this morning about wanting margin before the rush. Did the day leave you any?"
        ),
        (
            user: "A little. I protected the morning block, but the afternoon got eaten by meetings again.",
            assistant: "That's still a win — the morning block was the part you said mattered most. What's one thing from the afternoon you'd hand off or decline next time?"
        ),
        (
            user: "Probably the vendor review. I'm not even the right person for it.",
            assistant: "Then that's your two-sentence no for tomorrow. You've gotten good at those. Sleep on it, and maybe give the morning a little margin again."
        )
    ]

    // MARK: - VoiceCallService

    var events: AsyncStream<VoiceCallEvent> {
        broadcaster.makeStream()
    }

    func startCall(chatId: String) async throws {
        scriptTask?.cancel()
        broadcaster.send(.connecting)
        scriptTask = Task { [weak self] in
            await self?.runScript(chatId: chatId)
        }
    }

    func endCall() async {
        guard let task = scriptTask else { return }
        scriptTask = nil
        task.cancel()
        broadcaster.send(.ended(reason: nil))
    }

    func setMuted(_ muted: Bool) {
        isMuted = muted
    }

    // MARK: - Scripted call

    private func runScript(chatId: String) async {
        do {
            try await beat(0.5) // brief "connecting" window
            broadcaster.send(.connected)
            broadcaster.send(.listening)

            for exchange in Self.script {
                try await beat(1)
                broadcaster.send(.userSpeaking)
                try await beat(1.5)
                try await persistAndEmit(.user, exchange.user, chatId: chatId)

                // "Thinking", then speaking with growing partial captions.
                broadcaster.send(.assistantSpeaking(partial: nil))
                try await beat(1)
                for partial in Self.partials(of: exchange.assistant) {
                    broadcaster.send(.assistantSpeaking(partial: partial))
                    try await beat(0.75)
                }
                try await persistAndEmit(.assistant, exchange.assistant, chatId: chatId)
                broadcaster.send(.listening)
            }

            try await beat(1.5)
            scriptTask = nil
            broadcaster.send(.ended(reason: "Talk soon — I'll be here."))
        } catch is CancellationError {
            // endCall() already emitted .ended.
        } catch {
            Self.logger.error("scripted call failed: \(error.localizedDescription, privacy: .public)")
            scriptTask = nil
            broadcaster.send(.failed(message: error.localizedDescription))
        }
    }

    private func persistAndEmit(_ role: MessageRole, _ text: String, chatId: String) async throws {
        let message = ChatMessage(role: role, text: text)
        try await chats.appendMessage(message, to: chatId)
        try Task.checkCancellation()
        broadcaster.send(.transcriptUpdated(message))
    }

    /// Splits a sentence into ~thirds of cumulative text for live captions.
    private static func partials(of text: String) -> [String] {
        let words = text.split(separator: " ")
        guard words.count >= 6 else { return [text] }
        let third = words.count / 3
        return [
            words.prefix(third).joined(separator: " "),
            words.prefix(third * 2).joined(separator: " "),
            text
        ]
    }

    private func beat(_ multiplier: Double) async throws {
        try await Task.sleep(nanoseconds: UInt64(Double(beatDelay) * multiplier))
    }
}
