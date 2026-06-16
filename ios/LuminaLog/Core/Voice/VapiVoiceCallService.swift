import Combine
import Foundation
import OSLog
import Vapi

@MainActor
final class VapiVoiceCallService: VoiceCallService {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "voice")

    private let api: ProxyAPIClient
    private let broadcaster = VoiceCallEventBroadcaster()
    private var vapiClient: Vapi?
    private var cancellables = Set<AnyCancellable>()

    init(api: ProxyAPIClient) {
        self.api = api
    }

    // MARK: - DTOs

    struct CallConfigRequest: Encodable {
        let chatId: String
    }

    struct CallConfigResponse: Decodable {
        let publicKey: String
        let assistantId: String?
        let assistantOverrides: AssistantOverrides

        struct AssistantOverrides: Decodable {
            let model: Model
            let voice: Voice?
            let transcriber: Transcriber?

            struct Model: Decodable {
                let provider: String
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

        let callConfig: CallConfigResponse
        do {
            callConfig = try await api.post(
                path: "/v1/vapi/call-config",
                body: CallConfigRequest(chatId: chatId)
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
            let overrides = buildOverrides(callConfig)
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

    private func buildOverrides(_ config: CallConfigResponse) -> [String: Any] {
        var overrides: [String: Any] = [:]
        var model: [String: Any] = ["provider": config.assistantOverrides.model.provider]
        if let url = config.assistantOverrides.model.url { model["url"] = url }
        // Vapi requires `model.model` to be a string for custom-llm providers;
        // forward what the server sent (dropping it triggers a 400 "Call failed").
        if let name = config.assistantOverrides.model.model { model["model"] = name }
        overrides["model"] = model
        if let voice = config.assistantOverrides.voice {
            var v: [String: Any] = [:]
            if let p = voice.provider { v["provider"] = p }
            if let id = voice.voiceId { v["voiceId"] = id }
            overrides["voice"] = v
        }
        return overrides
    }
}
