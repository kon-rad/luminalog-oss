import Foundation
import OSLog
import FirebaseFirestore

/// Thrown when an encrypted write is attempted before the user's key is loaded.
enum CryptoUnavailableError: LocalizedError {
    case keyNotLoaded
    var errorDescription: String? {
        switch self {
        case .keyNotLoaded: return "Your secure key is not ready yet. Try again in a moment."
        }
    }
}

/// `JournalRepository` backed by the top-level `journals` collection,
/// always filtered by the signed-in user's id (spec §3).
///
/// Note: the recent-entries query (`userId ==` + `order by createdAt desc`)
/// requires a Firestore composite index (see README).
@MainActor
final class FirestoreJournalRepository: JournalRepository {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "firestore")

    private let db: Firestore
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore, db: Firestore = .firestore()) {
        self.auth = auth
        self.keys = keys
        self.db = db
    }

    private var journals: CollectionReference {
        db.collection("journals")
    }

    // MARK: - JournalRepository

    func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> {
        AsyncStream { continuation in
            guard let uid = self.auth.currentUserId else {
                continuation.yield([])
                continuation.finish()
                return
            }
            let listener = self.journals
                .whereField("userId", isEqualTo: uid)
                .order(by: "createdAt", descending: true)
                .limit(to: limit)
                .addSnapshotListener { snapshot, error in
                    guard let snapshot else {
                        // Keep the stream alive; the listener recovers on the
                        // next good snapshot (see protocol stream convention).
                        Self.logger.error("""
                        recentEntries listener error (journals where userId == \(uid, privacy: .private) \
                        order by createdAt desc limit \(limit)): \
                        \(error?.localizedDescription ?? "unknown", privacy: .public)
                        """)
                        return
                    }
                    guard let cipher = self.keys.currentCipher else {
                        continuation.yield([]); return
                    }
                    let entries = snapshot.documents.compactMap {
                        JournalEntry(documentId: $0.documentID, data: $0.data(), cipher: cipher)
                    }
                    continuation.yield(entries)
                }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func entries(after: Date?, limit: Int) async throws -> [JournalEntry] {
        guard let uid = auth.currentUserId else { return [] }
        var query: Query = journals
            .whereField("userId", isEqualTo: uid)
            .order(by: "createdAt", descending: true)
        if let after {
            query = query.whereField("createdAt", isLessThan: Timestamp(date: after))
        }
        guard let cipher = keys.currentCipher else { return [] }
        let snapshot = try await query.limit(to: limit).getDocuments()
        return snapshot.documents.compactMap {
            JournalEntry(documentId: $0.documentID, data: $0.data(), cipher: cipher)
        }
    }

    func entry(id: String) -> AsyncStream<JournalEntry?> {
        AsyncStream { continuation in
            let listener = self.journals.document(id)
                .addSnapshotListener { snapshot, error in
                    guard let snapshot else {
                        // Keep the stream alive; the listener recovers on the
                        // next good snapshot (see protocol stream convention).
                        Self.logger.error("""
                        entry listener error (journals/\(id, privacy: .private)): \
                        \(error?.localizedDescription ?? "unknown", privacy: .public)
                        """)
                        return
                    }
                    guard let cipher = self.keys.currentCipher else {
                        continuation.yield(nil); return
                    }
                    if let data = snapshot.data() {
                        continuation.yield(JournalEntry(documentId: snapshot.documentID, data: data, cipher: cipher))
                    } else {
                        continuation.yield(nil)
                    }
                }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func save(_ entry: JournalEntry) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        try await journals.document(entry.id).setData(try entry.firestoreData(cipher: cipher))
    }

    func updateAIFields(
        id: String,
        summary: AIGeneration?,
        insights: AIGeneration?,
        prompts: AIPrompts?
    ) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        var payload: [String: Any] = [:]
        if let summary { payload["summary"] = try summary.firestoreData(cipher: cipher, context: "journals.summary") }
        if let insights { payload["insights"] = try insights.firestoreData(cipher: cipher, context: "journals.insights") }
        if let prompts { payload["prompts"] = try prompts.firestoreData(cipher: cipher) }
        guard !payload.isEmpty else { return }
        do {
            // `updateData` fails on a missing document — unlike `setData`,
            // it can never resurrect a deleted entry.
            try await journals.document(id).updateData(payload)
        } catch let error as NSError
            where error.domain == FirestoreErrorDomain
                && error.code == FirestoreErrorCode.notFound.rawValue {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
    }

    func updateContent(
        id: String,
        content: String,
        contentEditedAt: Date,
        appendedMedia: [MediaItem]
    ) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        var payload: [String: Any] = [
            "content": try cipher.sealed(content, "journals.content"),
            "contentEditedAt": Timestamp(date: contentEditedAt),
            "updatedAt": FieldValue.serverTimestamp(),
        ]
        if !appendedMedia.isEmpty {
            // Media metadata (s3Key/kind/duration) is not field-encrypted; only
            // the S3 bytes are. arrayUnion appends without clobbering existing media.
            payload["media"] = FieldValue.arrayUnion(appendedMedia.map(\.firestoreData))
        }
        do {
            try await journals.document(id).updateData(payload)
        } catch let error as NSError
            where error.domain == FirestoreErrorDomain
                && error.code == FirestoreErrorCode.notFound.rawValue {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
    }

    func applyEntryEdit(
        id: String,
        title: String,
        content: String,
        contentEditedAt: Date?,
        edit: EditRecord
    ) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        var payload: [String: Any] = [
            "title": try cipher.sealed(title, "journals.title"),
            "content": try cipher.sealed(content, "journals.content"),
            "updatedAt": FieldValue.serverTimestamp(),
            "editHistory": FieldValue.arrayUnion([edit.firestoreData]),
        ]
        if let contentEditedAt {
            payload["contentEditedAt"] = Timestamp(date: contentEditedAt)
        }
        do {
            try await journals.document(id).updateData(payload)
        } catch let error as NSError
            where error.domain == FirestoreErrorDomain
                && error.code == FirestoreErrorCode.notFound.rawValue {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
    }

    func delete(id: String) async throws {
        try await journals.document(id).delete()
    }
}
