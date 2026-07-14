import Foundation

@MainActor
final class VoiceCallDetailViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var chat: Chat?
    @Published private(set) var recordingURL: URL?
    @Published private(set) var recordingState: RecordingState = .loading

    enum RecordingState: Equatable { case loading, processing, ready, unavailable }

    var wordCount: Int {
        messages.reduce(0) { count, msg in
            count + msg.text.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).count
        }
    }

    private let chatId: String
    private let repository: ChatRepository
    private let media: MediaUploader?
    private let importer: VoiceRecordingImporter?
    private var didStartImport = false

    init(chatId: String, repository: ChatRepository, media: MediaUploader?, importer: VoiceRecordingImporter?) {
        self.chatId = chatId
        self.repository = repository
        self.media = media
        self.importer = importer
    }

    func start() async {
        // One snapshot each — the voice transcript is static post-call, and the
        // recording state is derived from the chat's recordingPath/pendingRecordingKey.
        // (Do NOT loop the chats() stream: the repository never finishes it, so a
        // `for await` without a break would hang. Post-import the recording resolves
        // on the next view appearance / the AppServices foreground sweep.)
        for await snapshot in repository.messages(chatId: chatId) {
            messages = snapshot
            break
        }
        for await chats in repository.chats() {
            chat = chats.first { $0.id == chatId }
            break
        }
        await loadRecording()
    }

    func deleteChat() async {
        try? await repository.deleteChat(id: chatId)
    }

    private func loadRecording() async {
        guard let chat else { recordingState = .unavailable; return }
        if let path = chat.recordingPath, let media {
            do {
                recordingURL = try await media.localFileURL(for: path)
                recordingState = .ready
            } catch {
                recordingState = .unavailable
            }
            return
        }
        if chat.pendingRecordingKey != nil {
            recordingState = .processing
            // Kick the importer once so a recording made this session becomes playable
            // without waiting for the next launch sweep.
            if !didStartImport, let importer {
                didStartImport = true
                Task { await importer.process(chat: chat) }
            }
            return
        }
        recordingState = .unavailable
    }
}
