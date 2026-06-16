import Foundation
import OSLog

/// Drives one conversation (design §7): live message history, optimistic
/// sends, streaming AI replies, dictation into the input field, and a
/// read-only mode for voice-call transcripts.
///
/// Persistence note: the view model persists BOTH sides of the exchange via
/// `ChatRepository.appendMessage` — `MockAIService` does not write back to
/// the repository. The production proxy ALSO persists server-side (spec
/// §5.4); this client-side write is for demo mode and instant UI
/// consistency, mirroring the JournalDetail pattern.
@MainActor
final class ChatViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "chat")

    /// A user message whose send did not complete; surfaced with a Retry
    /// affordance (design §7).
    struct FailedSend: Equatable {
        let message: ChatMessage
        /// True when the user message reached the repository and only the
        /// AI stream failed — retry then skips re-appending it.
        let isPersisted: Bool
    }

    enum DictationState: Equatable {
        case idle
        case listening
    }

    // MARK: - Published state

    @Published var draft = ""
    @Published private(set) var messages: [ChatMessage] = []
    /// True once the first repository emission has landed.
    @Published private(set) var hasLoaded = false
    /// Accumulated partial assistant reply while streaming; nil otherwise.
    @Published private(set) var streamingReply: String?
    /// True between sending and the first streamed token (typing dots).
    @Published private(set) var isAwaitingFirstToken = false
    @Published private(set) var failedSend: FailedSend?
    /// Nav-bar title; updated locally after the first-message rename.
    @Published private(set) var title: String
    @Published private(set) var dictationState: DictationState = .idle
    @Published var showDictationDeniedAlert = false

    // MARK: - Dependencies & identity

    let chatId: String
    /// Voice-call transcripts open read-only: input hidden, banner shown.
    let isReadOnly: Bool

    private let repository: ChatRepository
    private let ai: AIService
    private let speech: SpeechTranscriber

    private var liveTask: Task<Void, Never>?
    private var hasStarted = false
    /// Set once the chat has been auto-titled so a slow `messages` stream
    /// can't cause a second rename.
    private var hasUpdatedTitle = false

    /// The in-flight dictation stream consumer; cancelled in deinit.
    private var dictationTask: Task<Void, Never>?
    /// Identifies the current dictation session so a finishing old session
    /// can never clobber the state/text of a newer one.
    private var dictationSessionId = UUID()

    init(
        chatId: String,
        kind: ChatKind,
        title: String,
        chats: ChatRepository,
        ai: AIService,
        speech: SpeechTranscriber
    ) {
        self.chatId = chatId
        self.isReadOnly = kind == .voice
        self.title = title
        self.repository = chats
        self.ai = ai
        self.speech = speech
    }

    deinit {
        liveTask?.cancel()
        dictationTask?.cancel()
    }

    // MARK: - Derived state

    var isResponding: Bool {
        isAwaitingFirstToken || streamingReply != nil
    }

    var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isResponding
            && failedSend == nil
    }

    /// Fresh text conversations greet the user with a static, client-side
    /// bubble (never persisted — design §7 "fresh conversation" state).
    var showsGreeting: Bool {
        hasLoaded && messages.isEmpty && !isReadOnly && !isResponding && failedSend == nil
    }

    static let greetingText = "I've been reading along in your journal. What's on your mind today?"

    // MARK: - Lifecycle

    /// Awaits the first message snapshot, then mirrors live updates.
    /// Idempotent — the view stays mounted across navigation.
    func start() async {
        guard !hasStarted else { return }
        hasStarted = true

        for await first in repository.messages(chatId: chatId) {
            messages = first
            break
        }
        hasLoaded = true

        liveTask = Task { [weak self] in
            guard let stream = self?.repository.messages(chatId: self?.chatId ?? "") else { return }
            for await messages in stream {
                guard let self, !Task.isCancelled else { return }
                self.messages = messages
            }
        }
    }

    // MARK: - Sending

    func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isResponding, failedSend == nil, !isReadOnly else { return }
        stopDictation()
        draft = ""
        await deliver(ChatMessage(role: .user, text: text), alreadyPersisted: false)
    }

    /// Re-attempts the failed send: re-appends the user message only when it
    /// never reached the repository, then re-runs the AI stream.
    func retry() async {
        guard let failed = failedSend, !isResponding else { return }
        failedSend = nil
        await deliver(failed.message, alreadyPersisted: failed.isPersisted)
    }

    func discardFailedSend() {
        failedSend = nil
    }

    private func deliver(_ message: ChatMessage, alreadyPersisted: Bool) async {
        var persisted = alreadyPersisted

        if !persisted {
            let isFirstUserMessage = !messages.contains { $0.role == .user }
            do {
                try await repository.appendMessage(message, to: chatId)
                persisted = true
            } catch {
                Self.logger.error("append user message failed: \(error.localizedDescription, privacy: .public)")
                failedSend = FailedSend(message: message, isPersisted: false)
                return
            }
            if isFirstUserMessage {
                await updateTitle(from: message.text)
            }
        }

        isAwaitingFirstToken = true
        var reply = ""
        do {
            for try await delta in ai.streamChatReply(chatId: chatId, message: message.text) {
                isAwaitingFirstToken = false
                reply += delta
                streamingReply = reply
            }
            isAwaitingFirstToken = false
            streamingReply = nil
            if !reply.isEmpty {
                try await repository.appendMessage(
                    ChatMessage(role: .assistant, text: reply),
                    to: chatId
                )
            }
        } catch {
            Self.logger.error("chat stream failed: \(error.localizedDescription, privacy: .public)")
            isAwaitingFirstToken = false
            streamingReply = nil
            failedSend = FailedSend(message: message, isPersisted: persisted)
        }
    }

    // MARK: - Title

    /// New chats are titled from their first user message (~40 chars).
    /// Best-effort: a failed rename never blocks the conversation.
    private func updateTitle(from text: String) async {
        guard !hasUpdatedTitle else { return }
        hasUpdatedTitle = true
        let newTitle = Self.title(from: text)
        do {
            try await repository.updateChatTitle(id: chatId, title: newTitle)
            title = newTitle
        } catch {
            Self.logger.error("rename chat failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    static func title(from text: String) -> String {
        let firstLine = text
            .components(separatedBy: .newlines)
            .first?
            .trimmingCharacters(in: .whitespaces) ?? text
        guard firstLine.count > 40 else { return firstLine }
        return String(firstLine.prefix(40)).trimmingCharacters(in: .whitespaces) + "…"
    }

    // MARK: - Dictation (same pattern as CreateEntryViewModel, simplified)

    /// Starts a dictation session into the input field. Partial transcripts
    /// are *cumulative*, so each partial replaces the current session
    /// segment: we snapshot the draft at session start (`base`) and set
    /// `draft = base + partial`.
    func startDictation() async {
        guard dictationState == .idle, !isReadOnly else { return }
        guard await speech.requestAuthorization() else {
            showDictationDeniedAlert = true
            return
        }

        let base = dictationBase(from: draft)
        let sessionId = UUID()
        dictationSessionId = sessionId
        dictationState = .listening
        let stream = speech.startLiveTranscription()

        dictationTask = Task { [weak self] in
            do {
                for try await partial in stream {
                    guard let self,
                          self.dictationSessionId == sessionId,
                          self.dictationState == .listening
                    else { return }
                    self.draft = base + partial
                }
            } catch is SpeechTranscriberError {
                self?.showDictationDeniedAlert = true
            } catch {
                Self.logger.error("dictation stream failed: \(error.localizedDescription, privacy: .public)")
            }
            if let self, self.dictationSessionId == sessionId {
                self.dictationState = .idle
            }
        }
    }

    func stopDictation() {
        guard dictationState == .listening else { return }
        speech.stopLiveTranscription()
        dictationState = .idle
    }

    func toggleDictation() async {
        if dictationState == .listening {
            stopDictation()
        } else {
            await startDictation()
        }
    }

    /// Mic-button action for the chat input (design §7): tap to start
    /// dictating, tap again to stop and send the transcript straight away.
    /// The live transcript has been filling `draft` as the user speaks, so
    /// stopping simply hands it to `send()` (which no-ops on empty input).
    func toggleDictationAndSend() async {
        if dictationState == .listening {
            stopDictation()
            await send()
        } else {
            await startDictation()
        }
    }

    private func dictationBase(from current: String) -> String {
        guard !current.isEmpty else { return "" }
        if let last = current.last, last.isWhitespace { return current }
        return current + " "
    }
}

// MARK: - Preview hooks

#if DEBUG
extension ChatViewModel {
    /// Seeds transient state so previews can render streaming/failed UI.
    func setPreviewState(
        streamingReply: String? = nil,
        isAwaitingFirstToken: Bool = false,
        failedSend: FailedSend? = nil
    ) {
        self.streamingReply = streamingReply
        self.isAwaitingFirstToken = isAwaitingFirstToken
        self.failedSend = failedSend
    }
}
#endif
