import Foundation
import OSLog
import FirebaseFirestore

/// `ChatRepository` backed by `chats/{chatId}` and its `messages`
/// subcollection (spec §3).
@MainActor
final class FirestoreChatRepository: ChatRepository {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "firestore")

    private let db: Firestore
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore, db: Firestore = .firestore()) {
        self.auth = auth
        self.keys = keys
        self.db = db
    }

    private var chatsRef: CollectionReference {
        db.collection("chats")
    }

    private func messagesRef(chatId: String) -> CollectionReference {
        chatsRef.document(chatId).collection("messages")
    }

    // MARK: - ChatRepository

    func chats() -> AsyncStream<[Chat]> {
        AsyncStream { continuation in
            guard let uid = self.auth.currentUserId else {
                continuation.yield([])
                continuation.finish()
                return
            }
            let listener = self.chatsRef
                .whereField("userId", isEqualTo: uid)
                .order(by: "lastMessageAt", descending: true)
                .addSnapshotListener { snapshot, error in
                    guard let snapshot else {
                        // Keep the stream alive; the listener recovers on the
                        // next good snapshot (see protocol stream convention).
                        Self.logger.error("""
                        chats listener error (chats where userId == \(uid, privacy: .private) \
                        order by lastMessageAt desc): \
                        \(error?.localizedDescription ?? "unknown", privacy: .public)
                        """)
                        return
                    }
                    guard let cipher = self.keys.currentCipher else {
                        continuation.yield([]); return
                    }
                    let chats = snapshot.documents.compactMap {
                        Chat(documentId: $0.documentID, data: $0.data(), cipher: cipher)
                    }
                    continuation.yield(chats)
                }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func messages(chatId: String) -> AsyncStream<[ChatMessage]> {
        AsyncStream { continuation in
            let listener = self.messagesRef(chatId: chatId)
                .order(by: "createdAt", descending: false)
                .addSnapshotListener { snapshot, error in
                    guard let snapshot else {
                        // Keep the stream alive; the listener recovers on the
                        // next good snapshot (see protocol stream convention).
                        Self.logger.error("""
                        messages listener error (chats/\(chatId, privacy: .private)/messages \
                        order by createdAt asc): \
                        \(error?.localizedDescription ?? "unknown", privacy: .public)
                        """)
                        return
                    }
                    guard let cipher = self.keys.currentCipher else {
                        continuation.yield([]); return
                    }
                    let messages = snapshot.documents.compactMap {
                        ChatMessage(documentId: $0.documentID, data: $0.data(), cipher: cipher)
                    }
                    continuation.yield(messages)
                }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func createChat(kind: ChatKind, title: String) async throws -> Chat {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        let chat = Chat(userId: uid, kind: kind, title: title)
        try await chatsRef.document(chat.id).setData(try chat.firestoreData(cipher: cipher))
        return chat
    }

    func appendMessage(_ message: ChatMessage, to chatId: String) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        let batch = db.batch()
        batch.setData(try message.firestoreData(cipher: cipher), forDocument: messagesRef(chatId: chatId).document(message.id))
        batch.updateData(
            ["lastMessageAt": Timestamp(date: message.createdAt)],
            forDocument: chatsRef.document(chatId)
        )
        try await batch.commit()
    }

    func updateChatTitle(id: String, title: String) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        let sealed = try cipher.encrypt(title, context: "chats.title").firestoreData
        try await chatsRef.document(id).updateData(["title": sealed])
    }

    func deleteChat(id: String) async throws {
        // Delete messages in pages, then the chat doc. (A proxy-side cascade
        // can replace this if message counts grow large.)
        while true {
            let page = try await messagesRef(chatId: id).limit(to: 250).getDocuments()
            if page.documents.isEmpty { break }
            let batch = db.batch()
            page.documents.forEach { batch.deleteDocument($0.reference) }
            try await batch.commit()
            if page.documents.count < 250 { break }
        }
        try await chatsRef.document(id).delete()
    }
}
