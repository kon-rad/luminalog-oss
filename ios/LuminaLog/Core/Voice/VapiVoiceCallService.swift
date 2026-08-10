import AVFoundation
import Combine
import CryptoKit
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
    /// Whether the assistant produced ANY spoken turn this call. Used to tell an
    /// error-ended call apart from a normal end: Vapi's SDK `.callDidEnd` carries no
    /// reason, so when the call ends and the assistant never said a word (e.g. the
    /// custom-LLM/model turn failed → Vapi drops the call as `custom-llm-llm-failed`)
    /// we surface `.failed` ("Call failed") instead of the benign `.ended` screen.
    /// User-initiated hang-ups don't reach `.callDidEnd` here (`endCall()` unsubscribes
    /// first), so this only classifies natural/error ends. See ADR-0093.
    private var assistantDidSpeak = false
    /// Whether Vapi ever transcribed a word from the USER this call. Distinguishes a
    /// real conversation from one where the companion could not hear the user at all
    /// (mic permission, a hijacked audio session, a dead input route) — which Vapi
    /// reports as `…error-assistant-did-not-receive-customer-audio`. See ADR-0110.
    private var userWasHeard = false
    /// Vends the currently-loaded per-user DEK (`UserKeyStore.currentDataKey`).
    /// Injected as a closure (mirrors the key-vending wiring in
    /// `AppServices`) so this service stays decoupled from `UserKeyStore` and is
    /// testable without a loaded key. On the Model-1/ZK path the DEK is base64'd
    /// into `CallConfigRequest.dek` so the server can do per-turn RAG mid-call.
    private let currentDEK: @MainActor () -> SymmetricKey?

    /// Requests (or re-reads) microphone permission. Injected so tests can drive the
    /// denied path without touching the real AVAudioApplication. See ADR-0110.
    private let requestMicPermission: () async -> Bool

    init(
        api: ProxyAPIClient,
        ai: AIService,
        currentDEK: @escaping @MainActor () -> SymmetricKey? = { nil },
        requestMicPermission: @escaping () async -> Bool = {
            // Returns immediately with the existing answer once decided; only the
            // first, undetermined call actually prompts.
            await AVAudioApplication.requestRecordPermission()
        }
    ) {
        self.api = api
        self.ai = ai
        self.currentDEK = currentDEK
        self.requestMicPermission = requestMicPermission
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
        /// Today's entries, fetched straight from the local DB (not RAG) and always
        /// included so the assistant can answer "what did I write today?".
        var todayContext: String?
        var ragContext: String?
        var focalEntry: String?
        /// Device-local wall clock at call start (`yyyy-MM-dd HH:mm zzz`) so the server
        /// can anchor the assistant's sense of "today"/"now" — the RAG blocks carry
        /// local timestamps, but the model needs a reference point to resolve them.
        var now: String?
        /// Base64 of the raw 32-byte per-user DEK, sent ONLY on the Model-1/ZK path
        /// (`DevFlags.aiModel1` + a loaded key). Its presence routes the call to our
        /// server-hosted custom-LLM proxy, which holds the DEK in RAM for the call's
        /// lifetime to run per-turn semantic RAG over the user's past entries and
        /// evicts it at end-of-call. Omitted (nil → not encoded) otherwise, keeping
        /// the legacy baked-prompt path unchanged. See the 2026-07-15 custom-LLM spec.
        var dek: String?
    }

    struct CallConfigResponse: Decodable {
        let publicKey: String
        let assistantId: String?
        let assistantOverrides: AssistantOverrides

        struct AssistantOverrides: Decodable {
            // Post-ADR-0077 the server injects the per-call system prompt via
            // `variableValues.systemPrompt` (substituted into the dashboard prompt's
            // `{{systemPrompt}}` placeholder) and sends NO `model` — Vapi rejects any
            // `model` override that lacks a provider. `model` stays optional only for
            // backward compatibility with the older custom-llm shape.
            let model: Model?
            let voice: Voice?
            let transcriber: Transcriber?
            /// Per-call Vapi template variables, e.g. `{ systemPrompt: … }`.
            let variableValues: [String: String]?
            /// `{ chatId }` so Vapi echoes it back in the end-of-call webhook.
            let metadata: [String: String]?

            struct Model: Decodable {
                // Legacy custom-llm shape: provider/url/model/messages. The current
                // server sends no `model` at all (see above).
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
        assistantDidSpeak = false
        userWasHeard = false

        // Microphone FIRST, before any context build or network call. Every other
        // audio path in the app already guards on this (AudioRecorderController,
        // SegmentRecorder, AppleSpeechTranscriber) — the call path did not, and the
        // failure was silent: Vapi connects, the assistant greets, but no customer
        // audio is ever sent, so Vapi ends the call as
        // `…error-assistant-did-not-receive-customer-audio`. Since the assistant DID
        // speak, the ADR-0093 classifier scored that as a normal end, leaving the user
        // talking to a companion that never responds. ADR-0110.
        guard await requestMicPermission() else {
            Self.logger.error("mic permission denied, refusing to start a call that could not hear the user")
            broadcaster.send(.failed(message: VoiceCallError.microphonePermissionDenied.localizedDescription))
            throw VoiceCallError.microphonePermissionDenied
        }

        broadcaster.send(.connecting)

        // Zero-knowledge (Model-1): build the RAG context ON DEVICE from plaintext and
        // send it so the server can bake it into the Vapi system prompt — no server-side
        // decryption mid-call. Bounded by a hard timeout: the first build after a fresh
        // launch primes the on-device embedding index (slow — it embeds every entry), and
        // we must NOT let that block the call from connecting. On timeout we start the call
        // with no context (the assistant just has less anchoring); the build keeps running
        // in the background so the index is primed for the next call.
        var request = CallConfigRequest(chatId: chatId, journalId: journalId)
        request.now = Self.localNowStamp()
        if let context = await boundedVoiceContext(journalId: journalId, seconds: 3) {
            request.name = context.name
            request.bio = context.bio
            request.profile = context.profile
            request.todayContext = context.todayContext
            request.ragContext = context.ragContext
            request.focalEntry = context.focalEntry
        }

        // Model-1/ZK path: hand the server the DEK so it can run per-turn RAG over PAST
        // entries mid-call (server-hosted custom-LLM proxy). When a DEK is sent, drop the
        // on-device PAST-RAG payload (`ragContext`) — the server owns that retrieval now
        // and would ignore it. We still send `todayContext`/`focalEntry`/`name`/`bio`/
        // `profile`/`now` (per-call, plaintext, not recomputed per turn). Nil-DEK calls
        // (aiModel1 off / key not loaded) keep the legacy baked-prompt behavior untouched.
        if let dek = Self.encodedDEK(aiModel1: DevFlags.aiModel1, key: currentDEK()) {
            request.dek = dek
            request.ragContext = nil
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
            // The SDK's `.callDidEnd` carries no end reason. A normal end always has
            // the assistant speaking at least a greeting; if it ends here without the
            // assistant ever producing a turn, the call errored (e.g. the custom-LLM
            // turn failed and Vapi dropped the call as `custom-llm-llm-failed`) — so
            // surface `.failed` instead of the benign "Call ended" screen. User hang-ups
            // don't reach here (`endCall()` unsubscribes first). ADR-0093.
            let endEvent = Self.endEvent(assistantDidSpeak: assistantDidSpeak, userWasHeard: userWasHeard)
            if case .failed = endEvent {
                Self.logger.error(
                    "call ended abnormally, assistantDidSpeak=\(self.assistantDidSpeak, privacy: .public) userWasHeard=\(self.userWasHeard, privacy: .public)"
                )
            } else {
                Self.logger.log("call ended")
            }
            broadcaster.send(endEvent)
            vapiClient = nil
            cancellables.removeAll()
        case .speechUpdate(let update):
            if update.role == .user {
                broadcaster.send(update.status == .started ? .userSpeaking : .listening)
            }
        case .transcript(let transcript):
            if transcript.role == .assistant {
                assistantDidSpeak = true
                broadcaster.send(.assistantSpeaking(partial: transcript.transcript))
            } else if !transcript.transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                // Proof that customer audio actually reached Vapi's transcriber.
                userWasHeard = true
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

    /// Device-local wall clock at call start, e.g. `2026-07-13 14:29 PDT`. Sent to the
    /// server so `PROMPTS.voiceChat` can anchor the assistant's "today"/"now" against
    /// the local timestamps carried in each RAG block.
    nonisolated static func localNowStamp(_ date: Date = Date(), timeZone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd HH:mm zzz"
        return formatter.string(from: date)
    }

    /// Base64 of the raw 32 bytes of `key`, but ONLY on the Model-1/ZK path with a
    /// loaded key — otherwise nil so `CallConfigRequest.dek` is omitted and the legacy
    /// baked-prompt voice path is preserved. `nonisolated static` (pure) so it is
    /// unit-testable without a live call or a real `UserKeyStore`.
    nonisolated static func encodedDEK(aiModel1: Bool, key: SymmetricKey?) -> String? {
        guard aiModel1, let key else { return nil }
        return key.withUnsafeBytes { Data($0) }.base64EncodedString()
    }

    /// Classifies an SDK `.callDidEnd` into the event the UI should show. Vapi's SDK
    /// carries no end reason, so we infer it: a call that ends without the assistant
    /// ever speaking a turn errored (e.g. the custom-LLM turn failed and Vapi dropped
    /// the call) and must surface as `.failed` ("Call failed"), not the benign "Call
    /// ended" screen. `nonisolated static` (pure) so it is unit-testable without the
    /// Vapi SDK or a live call. See ADR-0093.
    /// Classifies a natural/error `.callDidEnd` (user hang-ups never reach here —
    /// `endCall()` emits `.ended` and unsubscribes first).
    ///
    /// - assistant never spoke → the call died before it began (e.g. the custom-LLM
    ///   turn failed and Vapi dropped it as `custom-llm-llm-failed`). ADR-0093.
    /// - assistant spoke but the user was NEVER transcribed → Vapi received no
    ///   customer audio (`…error-assistant-did-not-receive-customer-audio`). This
    ///   previously scored as a NORMAL end, so a call where the companion simply
    ///   could not hear the user looked successful and showed a transcript screen.
    ///   Naming it is both accurate and actionable. ADR-0110.
    nonisolated static func endEvent(assistantDidSpeak: Bool, userWasHeard: Bool) -> VoiceCallEvent {
        if !assistantDidSpeak {
            return .failed(message: "The call couldn't connect. Please try again.")
        }
        if !userWasHeard {
            return .failed(message: "We couldn't hear you on that call. Check that Argo has microphone access in Settings, and that nothing else is using your mic.")
        }
        return .ended(reason: nil)
    }

    /// Maps the server's `assistantOverrides` into the dict the Vapi SDK expects.
    /// `nonisolated static` (pure function) so it is unit-testable without the Vapi
    /// SDK / a live call and callable off the main actor.
    nonisolated static func buildOverrides(_ config: CallConfigResponse) -> [String: Any] {
        var overrides: [String: Any] = [:]
        // The per-call personalized system prompt (name/bio/profile/RAG/focal entry) is
        // injected via Vapi template variables — the dashboard prompt is `{{systemPrompt}}`
        // and Vapi substitutes this value at call time (ADR-0077). Without it, the
        // assistant loses all personalization.
        if let vars = config.assistantOverrides.variableValues {
            overrides["variableValues"] = vars
        }
        // Legacy custom-llm shape: forward a `model` ONLY if the server actually sent
        // model keys. Sending a `model` object — even an empty one or a bare `messages`
        // override — makes Vapi validate it as a complete model config and reject the
        // call with `model.provider must be one of…` (a 400 "Call failed").
        if let m = config.assistantOverrides.model {
            var model: [String: Any] = [:]
            if let provider = m.provider { model["provider"] = provider }
            if let url = m.url { model["url"] = url }
            if let name = m.model { model["model"] = name }
            if let messages = m.messages {
                model["messages"] = messages.map { ["role": $0.role, "content": $0.content] }
            }
            if !model.isEmpty { overrides["model"] = model }
        }
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
