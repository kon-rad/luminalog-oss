import Foundation
import FirebaseFirestore

protocol DailyReportRepository: AnyObject {
    /// The most recent report generated for `date` ("yyyy-MM-dd"), or nil. A day
    /// can hold several reports; this returns the latest one.
    func report(for date: String) async throws -> DailyInsightsReport?
    /// Up to `limit` reports across all days, most recent first. Pass the id of
    /// the last report already loaded to page further back; nil loads the first page.
    func recentReports(limit: Int, after lastId: String?) async throws -> [DailyInsightsReport]
    /// Permanently deletes the report with Firestore document `id`.
    func deleteReport(id: String) async throws
}

/// `DailyReportRepository` backed by `dailyReports/{uid}/days/{yyyy-MM-dd}_{millis}`.
/// Document ids embed the date then generation time, so lexical id order is
/// chronological — the recent feed and latest-of-day both order by document id
/// DESCENDING. Firestore auto-indexes document id ASCENDING but NOT descending,
/// so this requires the `days` `__name__` DESC index declared in
/// firestore.indexes.json (project luminalog-5822e). Without it Firestore throws
/// FAILED_PRECONDITION and both generation and this feed break — see ADR-0043.
@MainActor
final class FirestoreDailyReportRepository: DailyReportRepository {

    private let db = Firestore.firestore()
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore) {
        self.auth = auth
        self.keys = keys
    }

    private func daysCollection(_ uid: String) -> CollectionReference {
        db.collection("dailyReports").document(uid).collection("days")
    }

    func report(for date: String) async throws -> DailyInsightsReport? {
        guard let uid = auth.currentUserId else { return nil }
        guard let cipher = keys.currentCipher else { return nil }
        // Latest document whose id has the `{date}_` prefix.
        let snap = try await daysCollection(uid)
            .order(by: FieldPath.documentID(), descending: true)
            .start(at: ["\(date)_\u{f8ff}"])
            .end(at: ["\(date)_"])
            .limit(to: 1)
            .getDocuments()
        guard let doc = snap.documents.first else { return nil }
        return try DailyInsightsReport(firestore: doc.data(), id: doc.documentID, cipher: cipher)
    }

    func recentReports(limit: Int, after lastId: String?) async throws -> [DailyInsightsReport] {
        guard let uid = auth.currentUserId else { return [] }
        guard let cipher = keys.currentCipher else { return [] }
        var query: Query = daysCollection(uid)
            .order(by: FieldPath.documentID(), descending: true)
        if let lastId {
            query = query.start(after: [lastId])
        }
        let snap = try await query.limit(to: limit).getDocuments()
        return snap.documents.compactMap { doc in
            try? DailyInsightsReport(firestore: doc.data(), id: doc.documentID, cipher: cipher)
        }
    }

    func deleteReport(id: String) async throws {
        guard let uid = auth.currentUserId else { return }
        try await daysCollection(uid).document(id).delete()
    }
}
