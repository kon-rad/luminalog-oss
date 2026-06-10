import Foundation

/// Read/write access to chats (`chats/{chatId}` + `messages` subcollection).
@MainActor
protocol ChatRepository: AnyObject {

    /// Live-updating list of the user's chats, most recent activity first.
    ///
    /// Streams never throw: backend errors are logged and the stream stays
    /// silent until the next good snapshot. Streams capture the user at
    /// creation and must be re-created on auth changes.
    func chats() -> AsyncStream<[Chat]>

    /// Live-updating message history for one chat, oldest first.
    ///
    /// Streams never throw: backend errors are logged and the stream stays
    /// silent until the next good snapshot. Streams capture the user at
    /// creation and must be re-created on auth changes.
    func messages(chatId: String) -> AsyncStream<[ChatMessage]>

    /// Create a new chat owned by the current user.
    func createChat(kind: ChatKind, title: String) async throws -> Chat

    /// Append a message and advance the chat's `lastMessageAt`.
    func appendMessage(_ message: ChatMessage, to chatId: String) async throws

    /// Delete a chat and its messages.
    func deleteChat(id: String) async throws
}
