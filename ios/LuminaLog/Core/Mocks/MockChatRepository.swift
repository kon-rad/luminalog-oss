import Foundation

/// In-memory `ChatRepository` for demo mode and tests.
@MainActor
final class MockChatRepository: ChatRepository {

    private var chatStore: [Chat]
    private var messageStore: [String: [ChatMessage]]

    private var chatContinuations: [UUID: AsyncStream<[Chat]>.Continuation] = [:]
    private var messageContinuations: [UUID: (chatId: String, continuation: AsyncStream<[ChatMessage]>.Continuation)] = [:]

    init(
        chats: [Chat] = MockData.chats,
        messages: [String: [ChatMessage]] = MockData.chatMessages
    ) {
        chatStore = chats.sorted { $0.lastMessageAt > $1.lastMessageAt }
        messageStore = messages.mapValues { $0.sorted { $0.createdAt < $1.createdAt } }
    }

    // MARK: - ChatRepository

    func chats() -> AsyncStream<[Chat]> {
        AsyncStream { continuation in
            let key = UUID()
            chatContinuations[key] = continuation
            continuation.onTermination = { [weak self] _ in
                // onTermination runs off the main actor; hop back before
                // touching main-actor state.
                Task { @MainActor in
                    self?.chatContinuations[key] = nil
                }
            }
            continuation.yield(chatStore)
        }
    }

    func messages(chatId: String) -> AsyncStream<[ChatMessage]> {
        AsyncStream { continuation in
            let key = UUID()
            messageContinuations[key] = (chatId, continuation)
            continuation.onTermination = { [weak self] _ in
                // onTermination runs off the main actor; hop back before
                // touching main-actor state.
                Task { @MainActor in
                    self?.messageContinuations[key] = nil
                }
            }
            continuation.yield(messageStore[chatId] ?? [])
        }
    }

    func createChat(kind: ChatKind, title: String, journalId: String?, journalTitle: String?) async throws -> Chat {
        let chat = Chat(userId: MockData.userId, kind: kind, title: title, journalId: journalId, journalTitle: journalTitle)
        chatStore.insert(chat, at: 0)
        messageStore[chat.id] = []
        broadcastChats()
        return chat
    }

    func appendMessage(_ message: ChatMessage, to chatId: String) async throws {
        messageStore[chatId, default: []].append(message)
        if let index = chatStore.firstIndex(where: { $0.id == chatId }) {
            chatStore[index].lastMessageAt = message.createdAt
            chatStore.sort { $0.lastMessageAt > $1.lastMessageAt }
        }
        broadcastMessages(chatId: chatId)
        broadcastChats()
    }

    func updateChatTitle(id: String, title: String) async throws {
        guard let index = chatStore.firstIndex(where: { $0.id == id }) else { return }
        chatStore[index].title = title
        broadcastChats()
    }

    func deleteChat(id: String) async throws {
        chatStore.removeAll { $0.id == id }
        messageStore[id] = nil
        broadcastMessages(chatId: id)
        broadcastChats()
    }

    // MARK: - Broadcast

    private func broadcastChats() {
        for continuation in chatContinuations.values {
            continuation.yield(chatStore)
        }
    }

    private func broadcastMessages(chatId: String) {
        for (_, value) in messageContinuations where value.chatId == chatId {
            value.continuation.yield(messageStore[chatId] ?? [])
        }
    }
}
