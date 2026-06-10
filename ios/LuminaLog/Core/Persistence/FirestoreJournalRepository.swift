import Foundation
import FirebaseFirestore

/// `JournalRepository` backed by the top-level `journals` collection,
/// always filtered by the signed-in user's id (spec §3).
final class FirestoreJournalRepository: JournalRepository {

    private let db: Firestore
    private let auth: AuthService

    init(auth: AuthService, db: Firestore = .firestore()) {
        self.auth = auth
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
                .addSnapshotListener { snapshot, _ in
                    guard let snapshot else { return }
                    let entries = snapshot.documents.compactMap {
                        JournalEntry(documentId: $0.documentID, data: $0.data())
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
        let snapshot = try await query.limit(to: limit).getDocuments()
        return snapshot.documents.compactMap {
            JournalEntry(documentId: $0.documentID, data: $0.data())
        }
    }

    func entry(id: String) -> AsyncStream<JournalEntry?> {
        AsyncStream { continuation in
            let listener = self.journals.document(id)
                .addSnapshotListener { snapshot, _ in
                    guard let snapshot else { return }
                    if let data = snapshot.data() {
                        continuation.yield(JournalEntry(documentId: snapshot.documentID, data: data))
                    } else {
                        continuation.yield(nil)
                    }
                }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func save(_ entry: JournalEntry) async throws {
        try await journals.document(entry.id).setData(entry.firestoreData)
    }

    func delete(id: String) async throws {
        try await journals.document(id).delete()
    }
}
