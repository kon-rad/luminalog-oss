import Foundation
import FirebaseFirestore

protocol EncouragementRepository: AnyObject {
    /// Every queued message that has not been scheduled yet, oldest first.
    func undelivered() async throws -> [EncouragementMessage]
    /// Whether a batch was already generated for `dateKey` ("yyyy-MM-dd").
    /// Guards against a second AI call on the same day.
    func hasBatch(forDateKey dateKey: String) async throws -> Bool
    /// Persists a freshly generated batch. The server holds no key, so the
    /// client owns persistence, exactly as it does for daily reports.
    func save(_ messages: [EncouragementMessage]) async throws
    /// Records that `id` was scheduled into a slot firing at `date`.
    func markDelivered(id: String, at date: Date) async throws
    /// Permanently deletes undelivered messages created before `date`.
    func deleteExpired(createdBefore date: Date) async throws
}

/// `EncouragementRepository` backed by `dailyEncouragements/{uid}/messages/{id}`.
///
/// Document ids embed the date then the generation time then the index, so
/// lexical id order is chronological and the queue can be read with a plain
/// document-id ASCENDING sort. Firestore auto-indexes document id ASCENDING, so
/// unlike `dailyReports` this needs no composite index.
@MainActor
final class FirestoreEncouragementRepository: EncouragementRepository {

    private let db = Firestore.firestore()
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore) {
        self.auth = auth
        self.keys = keys
    }

    private func messagesCollection(_ uid: String) -> CollectionReference {
        db.collection("dailyEncouragements").document(uid).collection("messages")
    }

    func undelivered() async throws -> [EncouragementMessage] {
        guard let uid = auth.currentUserId, let cipher = keys.currentCipher else { return [] }
        let snap = try await messagesCollection(uid)
            .whereField("deliveredAt", isEqualTo: NSNull())
            .order(by: FieldPath.documentID())
            .getDocuments()
        return snap.documents.compactMap { doc in
            try? EncouragementMessage(firestore: doc.data(), id: doc.documentID, cipher: cipher)
        }
    }

    func hasBatch(forDateKey dateKey: String) async throws -> Bool {
        guard let uid = auth.currentUserId else { return false }
        // Document ids start with the date key, so a prefix range finds the batch.
        let snap = try await messagesCollection(uid)
            .order(by: FieldPath.documentID())
            .start(at: ["\(dateKey)_"])
            .end(at: ["\(dateKey)_\u{f8ff}"])
            .limit(to: 1)
            .getDocuments()
        return !snap.documents.isEmpty
    }

    func save(_ messages: [EncouragementMessage]) async throws {
        guard let uid = auth.currentUserId, let cipher = keys.currentCipher else { return }
        let batch = db.batch()
        for message in messages {
            let ref = messagesCollection(uid).document(message.id)
            batch.setData(try message.firestoreData(cipher: cipher), forDocument: ref)
        }
        try await batch.commit()
    }

    func markDelivered(id: String, at date: Date) async throws {
        guard let uid = auth.currentUserId else { return }
        try await messagesCollection(uid).document(id)
            .updateData(["deliveredAt": Timestamp(date: date)])
    }

    func deleteExpired(createdBefore date: Date) async throws {
        guard let uid = auth.currentUserId else { return }
        let snap = try await messagesCollection(uid)
            .whereField("deliveredAt", isEqualTo: NSNull())
            .whereField("createdAt", isLessThan: Timestamp(date: date))
            .getDocuments()
        guard !snap.documents.isEmpty else { return }
        let batch = db.batch()
        for doc in snap.documents { batch.deleteDocument(doc.reference) }
        try await batch.commit()
    }
}

// MARK: - Encrypted Firestore mapping

extension EncouragementMessage {

    /// Decrypts `title` and `body` (AAD `dailyEncouragements.<key>`); the
    /// timestamps are plaintext. `id` is the Firestore document id.
    init(firestore data: [String: Any], id: String, cipher: FieldCipher) throws {
        self.init(
            id: id,
            title: try cipher.opened(data["title"], "dailyEncouragements.title"),
            body: try cipher.opened(data["body"], "dailyEncouragements.body"),
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue() ?? Date(timeIntervalSince1970: 0),
            deliveredAt: (data["deliveredAt"] as? Timestamp)?.dateValue()
        )
    }

    /// Seals `title` and `body` and passes the timestamps through, producing the
    /// document body written under `dailyEncouragements/{uid}/messages/{id}`.
    /// `deliveredAt` is written as `NSNull` while queued so the equality filter in
    /// `undelivered()` matches it (Firestore cannot query for a missing field).
    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "title": try cipher.sealed(title, "dailyEncouragements.title"),
            "body": try cipher.sealed(body, "dailyEncouragements.body"),
            "createdAt": Timestamp(date: createdAt),
        ]
        if let deliveredAt {
            data["deliveredAt"] = Timestamp(date: deliveredAt)
        } else {
            data["deliveredAt"] = NSNull()
        }
        return data
    }
}
