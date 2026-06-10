import Foundation

/// Whether a chat is a text conversation or a Vapi voice call.
enum ChatKind: String, Codable, CaseIterable, Sendable {
    case text
    case voice
}

/// A conversation — `chats/{chatId}` in Firestore.
struct Chat: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var userId: String
    var kind: ChatKind
    var title: String
    var createdAt: Date
    var lastMessageAt: Date
    var vapiCallId: String?

    init(
        id: String = UUID().uuidString,
        userId: String,
        kind: ChatKind = .text,
        title: String = "",
        createdAt: Date = Date(),
        lastMessageAt: Date = Date(),
        vapiCallId: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.kind = kind
        self.title = title
        self.createdAt = createdAt
        self.lastMessageAt = lastMessageAt
        self.vapiCallId = vapiCallId
    }
}
