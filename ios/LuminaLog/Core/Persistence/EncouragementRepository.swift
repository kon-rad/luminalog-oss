import Foundation
import FirebaseFirestore

protocol EncouragementRepository: AnyObject {
    /// Whether a batch was already generated for `dateKey` ("yyyy-MM-dd").
    /// Guards against a second AI call on the same day.
    func hasBatch(forDateKey dateKey: String) async throws -> Bool
    /// Persists a freshly generated day's echoes (up to one per time-of-day
    /// slot). The server holds no key, so the client owns persistence, exactly
    /// as it does for daily reports.
    func save(_ messages: [EncouragementMessage]) async throws
    /// Every echo generated for `dateKey`, in no particular order.
    func messages(forDateKey dateKey: String) async throws -> [EncouragementMessage]
    /// Records that `id` was scheduled into a slot firing at `date`.
    func markDelivered(id: String, at date: Date) async throws
    /// Up to `limit` messages already delivered at or before `now`, most recently
    /// delivered first. Pass the `deliveredAt` of the last message already loaded
    /// to page further back; nil loads the first page. Excludes messages merely
    /// scheduled for a later slot today, which carry a future `deliveredAt`
    /// (see `EncouragementMessage`'s doc comment on what "delivered" means).
    func recentDelivered(limit: Int, before now: Date, after lastDeliveredAt: Date?) async throws -> [EncouragementMessage]
}

/// `EncouragementRepository` backed by `dailyEncouragements/{uid}/messages/{id}`.
///
/// Document ids embed the date then the time-of-day slot, so lexical id order
/// is chronological and a day's batch (or its existence) can be read with a
/// plain document-id prefix range, no composite index needed.
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

    /// Document ids for `dateKey` all start with `"{dateKey}_"`, so a prefix
    /// range finds them without scanning the whole collection.
    private func dateKeyRange(_ uid: String, _ dateKey: String) -> Query {
        messagesCollection(uid)
            .order(by: FieldPath.documentID())
            .start(at: ["\(dateKey)_"])
            .end(at: ["\(dateKey)_\u{f8ff}"])
    }

    func hasBatch(forDateKey dateKey: String) async throws -> Bool {
        guard let uid = auth.currentUserId else { return false }
        let snap = try await dateKeyRange(uid, dateKey).limit(to: 1).getDocuments()
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

    func messages(forDateKey dateKey: String) async throws -> [EncouragementMessage] {
        guard let uid = auth.currentUserId, let cipher = keys.currentCipher else { return [] }
        let snap = try await dateKeyRange(uid, dateKey).getDocuments()
        return snap.documents.compactMap { doc in
            try? EncouragementMessage(firestore: doc.data(), id: doc.documentID, cipher: cipher)
        }
    }

    func markDelivered(id: String, at date: Date) async throws {
        guard let uid = auth.currentUserId else { return }
        try await messagesCollection(uid).document(id)
            .updateData(["deliveredAt": Timestamp(date: date)])
    }

    func recentDelivered(limit: Int, before now: Date, after lastDeliveredAt: Date?) async throws -> [EncouragementMessage] {
        guard let uid = auth.currentUserId, let cipher = keys.currentCipher else { return [] }
        // The inequality filter and the orderBy must share a field (Firestore
        // requirement), which also gives us the exclusion for free: an
        // undelivered message has no `deliveredAt` field at all, and a missing
        // field never satisfies `<=`, so it never matches this query.
        var query: Query = messagesCollection(uid)
            .whereField("deliveredAt", isLessThanOrEqualTo: Timestamp(date: now))
            .order(by: "deliveredAt", descending: true)
        if let lastDeliveredAt {
            query = query.start(after: [Timestamp(date: lastDeliveredAt)])
        }
        let snap = try await query.limit(to: limit).getDocuments()
        return snap.documents.compactMap { doc in
            try? EncouragementMessage(firestore: doc.data(), id: doc.documentID, cipher: cipher)
        }
    }
}

// MARK: - Encrypted Firestore mapping

/// Thrown when a stored document doesn't decode as a current-shape Echo
/// (e.g. a `title`/`body` document from before this feature's Mirror
/// redesign). Every read site wraps decoding in `try?`, so this just makes the
/// document silently skipped rather than mis-attributed to `.morning`.
private struct MalformedEncouragementDocument: Error {}

extension EncouragementMessage {

    /// Decrypts `text` (AAD `dailyEncouragements.text`); the timestamps and
    /// `timeOfDay` are plaintext. `id` is the Firestore document id.
    init(firestore data: [String: Any], id: String, cipher: FieldCipher) throws {
        guard let timeOfDay = TimeOfDay(rawValue: data["timeOfDay"] as? String ?? "") else {
            throw MalformedEncouragementDocument()
        }
        self.init(
            id: id,
            timeOfDay: timeOfDay,
            text: try cipher.opened(data["text"], "dailyEncouragements.text"),
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue() ?? Date(timeIntervalSince1970: 0),
            deliveredAt: (data["deliveredAt"] as? Timestamp)?.dateValue()
        )
    }

    /// Seals `text` and passes the timestamps/`timeOfDay` through, producing the
    /// document body written under `dailyEncouragements/{uid}/messages/{id}`.
    /// `deliveredAt` is omitted entirely while queued (not written as `NSNull`):
    /// nothing queries for "field is absent" any more, and a genuinely missing
    /// field already fails `recentDelivered`'s `<=` filter the same way.
    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "timeOfDay": timeOfDay.rawValue,
            "text": try cipher.sealed(text, "dailyEncouragements.text"),
            "createdAt": Timestamp(date: createdAt),
        ]
        if let deliveredAt {
            data["deliveredAt"] = Timestamp(date: deliveredAt)
        }
        return data
    }
}
