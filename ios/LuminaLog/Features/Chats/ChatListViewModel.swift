import Foundation
import OSLog

/// Drives the Chats list (design §6): live chat history sorted by most
/// recent activity, new-chat creation, and swipe-to-delete.
@MainActor
final class ChatListViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "chat-list")

    // MARK: - Published state

    /// All chats, most recent activity first.
    @Published private(set) var chats: [Chat] = []
    /// True once the first stream emission has landed (loading → settled).
    @Published private(set) var hasLoaded = false

    private let repository: ChatRepository
    private var liveTask: Task<Void, Never>?
    private var hasStarted = false

    init(chats: ChatRepository) {
        self.repository = chats
    }

    deinit {
        liveTask?.cancel()
    }

    // MARK: - Lifecycle

    /// Awaits the first snapshot, then mirrors live updates. Idempotent —
    /// the list stays mounted across tab switches.
    func start() async {
        guard !hasStarted else { return }
        hasStarted = true

        for await first in repository.chats() {
            apply(first)
            break
        }
        hasLoaded = true

        liveTask = Task { [weak self] in
            guard let stream = self?.repository.chats() else { return }
            for await chats in stream {
                guard let self, !Task.isCancelled else { return }
                self.apply(chats)
            }
        }
    }

    /// Defensive sort — repositories already order by `lastMessageAt`
    /// descending, but the list owns its display invariant.
    private func apply(_ chats: [Chat]) {
        self.chats = chats.sorted { $0.lastMessageAt > $1.lastMessageAt }
    }

    // MARK: - Intents

    /// Creates a fresh text chat; the caller navigates into it. The chat is
    /// titled from its first user message later (`ChatViewModel`).
    func startTextChat() async -> Chat? {
        do {
            return try await repository.createChat(kind: .text, title: "New chat")
        } catch {
            Self.logger.error("create chat failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    func delete(_ chat: Chat) async {
        do {
            try await repository.deleteChat(id: chat.id)
        } catch {
            Self.logger.error("delete chat failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
