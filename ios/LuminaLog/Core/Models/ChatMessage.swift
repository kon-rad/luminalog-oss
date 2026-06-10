import Foundation

/// Who authored a chat message.
enum MessageRole: String, Codable, Sendable {
    case user
    case assistant
}

/// One message — `chats/{chatId}/messages/{messageId}` in Firestore.
struct ChatMessage: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var role: MessageRole
    var text: String
    var createdAt: Date

    init(
        id: String = UUID().uuidString,
        role: MessageRole,
        text: String,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.createdAt = createdAt
    }
}
