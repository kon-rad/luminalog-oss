import Foundation

struct RecordingURLRequest: Encodable { let chatId: String }
struct RecordingURLResponse: Decodable { let url: URL }

/// Backs the post-call detail screen: loads the persisted messages, the chat's
/// voice metadata, and a short-lived signed URL for the audio recording.
@MainActor
final class VoiceCallDetailViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var chat: Chat?
    @Published private(set) var recordingURL: URL?
    @Published private(set) var recordingState: RecordingState = .loading

    enum RecordingState: Equatable { case loading, ready, unavailable }

    private let chatId: String
    private let repository: ChatRepository
    private let api: ProxyAPIClient?

    init(chatId: String, repository: ChatRepository, api: ProxyAPIClient?) {
        self.chatId = chatId
        self.repository = repository
        self.api = api
    }

    func start() async {
        // First snapshot of messages (the stream already decrypts each message).
        for await snapshot in repository.messages(chatId: chatId) {
            messages = snapshot
            break
        }
        await loadChat()
        await loadRecording()
    }

    private func loadChat() async {
        // No single-chat fetch on the protocol; take it from the chats stream.
        for await chats in repository.chats() {
            chat = chats.first { $0.id == chatId }
            break
        }
    }

    private func loadRecording() async {
        guard let api else { recordingState = .unavailable; return }
        do {
            let res: RecordingURLResponse = try await api.post(
                path: "/v1/vapi/recording-url",
                body: RecordingURLRequest(chatId: chatId)
            )
            recordingURL = res.url
            recordingState = .ready
        } catch {
            recordingState = .unavailable
        }
    }
}
