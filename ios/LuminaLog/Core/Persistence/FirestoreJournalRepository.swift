import Foundation
import OSLog
import FirebaseFirestore

/// `JournalRepository` backed by the top-level `journals` collection,
/// always filtered by the signed-in user's id (spec §3).
///
/// Note: the recent-entries query (`userId ==` + `order by createdAt desc`)
/// requires a Firestore composite index (see README).
@MainActor
final class FirestoreJournalRepository: JournalRepository {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "firestore")

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

    func updateAIFields(
        id: String,
        summary: AIGeneration?,
        insights: AIGeneration?,
        prompts: AIPrompts?
    ) async throws {
        var payload: [String: Any] = [:]
        if let summary { payload["summary"] = summary.firestoreData }
        if let insights { payload["insights"] = insights.firestoreData }
        if let prompts { payload["prompts"] = prompts.firestoreData }
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

    func delete(id: String) async throws {
        try await journals.document(id).delete()
    }
}
