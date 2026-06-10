import Foundation
import OSLog

/// Production `VoiceCallService` seam for the Vapi iOS SDK (architecture
/// spec §5.5).
///
/// **Current status:** fetches the per-call assistant configuration from the
/// proxy (`POST /v1/vapi/call-config`) and then fails with
/// `VoiceCallError.sdkNotIntegrated`, because the Vapi SPM package is
/// intentionally NOT added in this task (no new dependencies).
///
/// ── Vapi SDK integration steps (backend-integration task) ──────────────────
/// 1. Add the SPM package `https://github.com/VapiAI/ios` (product `Vapi`)
///    to `project.yml` and run `xcodegen generate`.
/// 2. In `startCall(chatId:)`, after fetching `CallConfigResponse`:
///        let vapi = Vapi(publicKey: config.publicKey)
///        try await vapi.start(assistantId: config.assistantId,
///                             assistantOverrides: config.assistantOverrides)
///    The overrides point `model` at our proxy's `/v1/vapi/llm`
///    (`provider: "custom-llm"`, signed short-lived token in the URL), so
///    every conversational turn runs the same biography + RAG pipeline as
///    text chat. No third-party secrets ever ship in the app — the public
///    key is designed to be client-side.
/// 3. Map Vapi delegate/publisher events onto `VoiceCallEvent` and forward
///    them through `broadcaster.send(_:)`:
///        callDidStart                → .connected
///        speechUpdate (assistant)    → .assistantSpeaking(partial:)
///        speechUpdate (user)         → .userSpeaking
///        transcript (final)          → .transcriptUpdated(ChatMessage(...))
///        callDidEnd                  → .ended(reason:)
///        error                       → .failed(message:)
///    Idle gaps between turns map to `.listening`.
/// 4. `endCall()` → `vapi.stop()`; `setMuted(_:)` → `vapi.setMuted(_:)`.
/// 5. Transcript persistence stays SERVER-SIDE: the call-ended webhook
///    (`POST /v1/webhooks/vapi`) writes the full transcript into
///    `chats/{chatId}/messages`, so this client never writes voice
///    transcripts itself (unlike `MockVoiceCallService`, which must).
/// ───────────────────────────────────────────────────────────────────────────
@MainActor
final class VapiVoiceCallService: VoiceCallService {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "voice")

    private let api: ProxyAPIClient
    private let broadcaster = VoiceCallEventBroadcaster()

    init(api: ProxyAPIClient) {
        self.api = api
    }

    // MARK: - DTOs (spec §4.1 / §5.5)

    struct CallConfigRequest: Encodable {
        let chatId: String
    }

    /// Per-call configuration returned by `POST /v1/vapi/call-config`.
    /// Contains no secrets — only the Vapi *public* key and assistant
    /// overrides whose model URL embeds a signed, short-lived token.
    struct CallConfigResponse: Decodable {
        /// Vapi public SDK key (client-safe by design).
        let publicKey: String
        /// Pre-created Vapi assistant id, when the proxy uses one.
        let assistantId: String?
        let assistantOverrides: AssistantOverrides

        struct AssistantOverrides: Decodable {
            let model: Model
            let voice: Voice?
            let transcriber: Transcriber?

            struct Model: Decodable {
                /// `"custom-llm"` — Vapi calls our proxy for every turn.
                let provider: String
                /// `POST /v1/vapi/llm` URL with the signed per-call token.
                let url: String?
                let model: String?
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

    func startCall(chatId: String) async throws {
        broadcaster.send(.connecting)

        // Step 1 of the pipeline works today: fetch assistant overrides.
        let config: CallConfigResponse
        do {
            config = try await api.post(
                path: "/v1/vapi/call-config",
                body: CallConfigRequest(chatId: chatId)
            )
        } catch {
            Self.logger.error("call-config failed: \(error.localizedDescription, privacy: .public)")
            broadcaster.send(.failed(message: VoiceCallError.callConfigFailed(error.localizedDescription).localizedDescription))
            throw VoiceCallError.callConfigFailed(error.localizedDescription)
        }

        // Step 2 requires the Vapi SDK — see the integration steps above.
        Self.logger.notice("call-config fetched (assistant \(config.assistantId ?? "overrides-only", privacy: .public)) but the Vapi SDK is not integrated")
        broadcaster.send(.failed(message: VoiceCallError.sdkNotIntegrated.localizedDescription))
        throw VoiceCallError.sdkNotIntegrated
    }

    func endCall() async {
        // No live SDK session to tear down yet.
        broadcaster.send(.ended(reason: nil))
    }

    func setMuted(_ muted: Bool) {
        // Forwarded to `vapi.setMuted(_:)` once the SDK is integrated.
    }
}
