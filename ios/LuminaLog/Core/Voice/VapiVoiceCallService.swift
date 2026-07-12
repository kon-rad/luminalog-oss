import Combine
import Foundation
import OSLog
import Vapi

@MainActor
final class VapiVoiceCallService: VoiceCallService {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "voice")

    private let api: ProxyAPIClient
    private let ai: AIService
    private let broadcaster = VoiceCallEventBroadcaster()
    private var vapiClient: Vapi?
    private var cancellables = Set<AnyCancellable>()

    init(api: ProxyAPIClient, ai: AIService) {
        self.api = api
        self.ai = ai
    }

    // MARK: - DTOs

    struct CallConfigRequest: Encodable {
        let chatId: String
        let journalId: String?
        // Zero-knowledge (Model-1): PLAINTEXT context built on-device and baked into the
        // Vapi system prompt server-side, so the server never decrypts mid-call. Omitted
        // (nil → not encoded) on the legacy path, where the server builds context itself.
        var name: String?
        var bio: String?
        var profile: [String: String]?
        var ragContext: String?
        var focalEntry: String?
    }

    struct CallConfigResponse: Decodable {
        let publicKey: String
        let assistantId: String?
        let assistantOverrides: AssistantOverrides

        struct AssistantOverrides: Decodable {
            let model: Model
            let voice: Voice?
            let transcriber: Transcriber?
            /// `{ chatId }` so Vapi echoes it back in the end-of-call webhook.
            let metadata: [String: String]?

            struct Model: Decodable {
                // Post-ADR-0077 the server overrides ONLY `messages` (the per-call
                // personalized system prompt) and lets Vapi use its dashboard-configured
                // model — so provider/url/model are absent. They stay optional for
                // backward compatibility with the older custom-llm shape.
                let provider: String?
                let url: String?
                let model: String?
                let messages: [Message]?

                struct Message: Decodable {
                    let role: String
                    let content: String
                }
            }
            struct Voice: Decodable {
                let provider: String?
                let voiceId: String?
            }
            struct Transcriber: Decodable {
                let provider: String?
                let model: String?
                let language: String?
            }
        }
    }

    // MARK: - VoiceCallService

    var events: AsyncStream<VoiceCallEvent> {
        broadcaster.makeStream()
    }

    func startCall(chatId: String, journalId: String?, journalTitle: String?) async throws {
        broadcaster.send(.connecting)

        // Zero-knowledge (Model-1): build the RAG context ON DEVICE from plaintext and
        // send it so the server can bake it into the Vapi system prompt — no server-side
        // decryption mid-call. Bounded by a hard timeout: the first build after a fresh
        // launch primes the on-device embedding index (slow — it embeds every entry), and
        // we must NOT let that block the call from connecting. On timeout we start the call
        // with no context (the assistant just has less anchoring); the build keeps running
        // in the background so the index is primed for the next call.
        var request = CallConfigRequest(chatId: chatId, journalId: journalId)
        if let context = await boundedVoiceContext(journalId: journalId, seconds: 6) {
            request.name = context.name
            request.bio = context.bio
            request.profile = context.profile
            request.ragContext = context.ragContext
            request.focalEntry = context.focalEntry
        }

        let callConfig: CallConfigResponse
        do {
            callConfig = try await api.post(
                path: "/v1/vapi/call-config",
                body: request
            )
        } catch {
            Self.logger.error("call-config failed: \(error.localizedDescription, privacy: .public)")
            broadcaster.send(.failed(message: VoiceCallError.callConfigFailed(error.localizedDescription).localizedDescription))
            throw VoiceCallError.callConfigFailed(error.localizedDescription)
        }

        guard let assistantId = callConfig.assistantId else {
            broadcaster.send(.failed(message: VoiceCallError.callConfigFailed("No assistant ID configured").localizedDescription))
            throw VoiceCallError.callConfigFailed("No assistant ID configured")
        }

        let vapi = Vapi(publicKey: callConfig.publicKey)
        vapiClient = vapi

        vapi.eventPublisher
            .sink { [weak self] event in
                Task { @MainActor [weak self] in
                    self?.handleVapiEvent(event)
                }
            }
            .store(in: &cancellables)

        do {
            let overrides = Self.buildOverrides(callConfig)
            _ = try await vapi.start(assistantId: assistantId, assistantOverrides: overrides)
        } catch {
            Self.logger.error("Vapi start failed: \(error.localizedDescription, privacy: .public)")
            broadcaster.send(.failed(message: error.localizedDescription))
            vapiClient = nil
            cancellables.removeAll()
            throw VoiceCallError.callConfigFailed(error.localizedDescription)
        }
    }

    func endCall() async {
        vapiClient?.stop()
        vapiClient = nil
        cancellables.removeAll()
        broadcaster.send(.ended(reason: nil))
    }

    func setMuted(_ muted: Bool) {
        guard let vapi = vapiClient else { return }
        Task {
            try? await vapi.setMuted(muted)
        }
    }

    // MARK: - Event handling

    private func handleVapiEvent(_ event: Vapi.Event) {
        switch event {
        case .callDidStart:
            broadcaster.send(.connected)
        case .callDidEnd:
            // The authoritative end reason is persisted by the webhook and read
            // from chat.endedReason on the detail page (the SDK carries none here).
            Self.logger.log("call ended")
            broadcaster.send(.ended(reason: nil))
            vapiClient = nil
            cancellables.removeAll()
        case .speechUpdate(let update):
            if update.role == .user {
                broadcaster.send(update.status == .started ? .userSpeaking : .listening)
            }
        case .transcript(let transcript):
            if transcript.role == .assistant {
                broadcaster.send(.assistantSpeaking(partial: transcript.transcript))
            }
            if transcript.transcriptType == .final {
                let chatMessage = ChatMessage(
                    id: UUID().uuidString,
                    role: transcript.role == .assistant ? .assistant : .user,
                    text: transcript.transcript,
                    createdAt: Date()
                )
                broadcaster.send(.transcriptUpdated(chatMessage))
            }
        case .error(let error):
            broadcaster.send(.failed(message: error.localizedDescription))
            vapiClient = nil
            cancellables.removeAll()
        default:
            break
        }
    }

    // MARK: - Helpers

    /// Builds the voice context but gives up after `seconds`, returning nil. The build
    /// keeps running unstructured on timeout so a slow first-time index prime still
    /// completes in the background (ready for the next call) without blocking connection.
    private func boundedVoiceContext(journalId: String?, seconds: Double) async -> VoiceCallContext? {
        await withCheckedContinuation { (continuation: CheckedContinuation<VoiceCallContext?, Never>) in
            let once = ResumeOnce()
            Task { @MainActor in
                let ctx = try? await self.ai.voiceCallContext(journalId: journalId)
                if once.claim() { continuation.resume(returning: ctx) }
            }
            Task {
                try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                if once.claim() { continuation.resume(returning: nil) }
            }
        }
    }

    /// Maps the server's `assistantOverrides` into the dict the Vapi SDK expects.
    /// `nonisolated static` (pure function) so it is unit-testable without the Vapi
    /// SDK / a live call and callable off the main actor.
    nonisolated static func buildOverrides(_ config: CallConfigResponse) -> [String: Any] {
        let m = config.assistantOverrides.model
        var overrides: [String: Any] = [:]
        var model: [String: Any] = [:]
        if let provider = m.provider { model["provider"] = provider }
        if let url = m.url { model["url"] = url }
        // Vapi requires `model.model` to be a string for custom-llm providers;
        // forward what the server sent (dropping it triggers a 400 "Call failed").
        if let name = m.model { model["model"] = name }
        // The per-call personalized system prompt (name/bio/profile/RAG/focal entry)
        // lands here; Vapi merges it over its dashboard-configured model (ADR-0077).
        // Without this, the assistant loses all personalization.
        if let messages = m.messages {
            model["messages"] = messages.map { ["role": $0.role, "content": $0.content] }
        }
        overrides["model"] = model
        if let voice = config.assistantOverrides.voice {
            var v: [String: Any] = [:]
            if let p = voice.provider { v["provider"] = p }
            if let id = voice.voiceId { v["voiceId"] = id }
            overrides["voice"] = v
        }
        // The server pins the speech-to-text provider (Deepgram) for the call.
        if let t = config.assistantOverrides.transcriber {
            var tr: [String: Any] = [:]
            if let p = t.provider { tr["provider"] = p }
            if let name = t.model { tr["model"] = name }
            if let lang = t.language { tr["language"] = lang }
            overrides["transcriber"] = tr
        }
        // chatId metadata → Vapi echoes it in the end-of-call webhook so the
        // server can associate the transcript + recording with this chat.
        if let metadata = config.assistantOverrides.metadata {
            overrides["metadata"] = metadata
        }
        return overrides
    }
}

/// Thread-safe one-shot guard so exactly one of the racing context/timeout tasks
/// resumes the continuation (resuming a `CheckedContinuation` twice would crash).
private final class ResumeOnce: @unchecked Sendable {
    private let lock = NSLock()
    private var claimed = false
    func claim() -> Bool {
        lock.lock(); defer { lock.unlock() }
        if claimed { return false }
        claimed = true
        return true
    }
}
