import Foundation

/// Who authored a chat message.
enum MessageRole: String, Codable, Sendable {
    case user
    case assistant
}

/// A journal-entry citation attached to an assistant message (RAG source).
struct MessageSource: Codable, Equatable, Sendable {
    var journalId: String
    var snippet: String

    init(journalId: String, snippet: String) {
        self.journalId = journalId
        self.snippet = snippet
    }
}

/// One message — `chats/{chatId}/messages/{messageId}` in Firestore.
struct ChatMessage: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var role: MessageRole
    var text: String
    var createdAt: Date
    /// Journal entries the assistant drew on for this reply (proxy-written).
    var sources: [MessageSource]?

    init(
        id: String = UUID().uuidString,
        role: MessageRole,
        text: String,
        createdAt: Date = Date(),
        sources: [MessageSource]? = nil
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.createdAt = createdAt
        self.sources = sources
    }
}
