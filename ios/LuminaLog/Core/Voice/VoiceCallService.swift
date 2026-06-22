import Foundation

/// Errors surfaced by `VoiceCallService` implementations.
enum VoiceCallError: LocalizedError {
    /// The Vapi iOS SDK is not integrated yet (deferred to the
    /// backend-integration task — see `VapiVoiceCallService`).
    case sdkNotIntegrated
    /// The proxy refused to issue a per-call configuration.
    case callConfigFailed(String)

    var errorDescription: String? {
        switch self {
        case .sdkNotIntegrated:
            return "Voice calls aren't available yet in this build."
        case .callConfigFailed(let message):
            return "The call couldn't be set up: \(message)"
        }
    }
}

/// One state-change or transcript event during a voice call.
///
/// In production these map 1:1 onto Vapi SDK delegate events (architecture
/// spec §5.5); in demo mode `MockVoiceCallService` emits a scripted sequence.
enum VoiceCallEvent: Equatable, Sendable {
    /// Transport/session setup has begun.
    case connecting
    /// The call is live; the duration timer should start.
    case connected
    /// The assistant is idle and waiting for the user.
    case listening
    /// The assistant is thinking (`partial == nil`) or speaking
    /// (`partial` carries the in-progress spoken text for live captions).
    case assistantSpeaking(partial: String?)
    /// The user's microphone is picking up speech.
    case userSpeaking
    /// A finalized transcript message (user or assistant) was produced.
    case transcriptUpdated(ChatMessage)
    /// The call finished normally.
    case ended(reason: String?)
    /// The call failed to connect or dropped with an error.
    case failed(message: String)
}

/// Real-time voice conversation with the AI companion (design §8,
/// architecture §5.5). Vapi is the transport; our proxy is the brain.
@MainActor
protocol VoiceCallService: AnyObject {

    /// Multicast stream of call events. Each access returns a fresh stream;
    /// subscribe *before* calling `startCall` so the `connecting` transition
    /// is observed (events are buffered per-stream once subscribed).
    var events: AsyncStream<VoiceCallEvent> { get }

    /// Begin a call whose transcript persists into `chats/{chatId}`.
    /// Pass `journalId`/`journalTitle` to anchor the AI on a specific entry.
    /// Throws when the call cannot be set up at all; failures after setup
    /// are reported via `events` (`.failed`).
    func startCall(chatId: String, journalId: String?, journalTitle: String?) async throws

    /// Hang up. Emits `.ended` on the event stream.
    func endCall() async

    /// Mute or unmute the user's microphone.
    func setMuted(_ muted: Bool)
}

/// Shared multicast helper for `VoiceCallService` implementations — same
/// continuation-registry pattern as `MockChatRepository`'s streams.
@MainActor
final class VoiceCallEventBroadcaster {

    private var continuations: [UUID: AsyncStream<VoiceCallEvent>.Continuation] = [:]

    /// Registers a new subscriber stream. The continuation is captured
    /// synchronously, so events sent after this call are buffered for the
    /// subscriber even before iteration begins.
    func makeStream() -> AsyncStream<VoiceCallEvent> {
        AsyncStream { continuation in
            let key = UUID()
            continuations[key] = continuation
            continuation.onTermination = { [weak self] _ in
                // onTermination runs off the main actor; hop back before
                // touching main-actor state.
                Task { @MainActor in
                    self?.continuations[key] = nil
                }
            }
        }
    }

    func send(_ event: VoiceCallEvent) {
        for continuation in continuations.values {
            continuation.yield(event)
        }
    }
}
