import Foundation
import FirebaseFirestore

protocol DailyReportRepository: AnyObject {
    /// Loads a saved report for `date` ("yyyy-MM-dd"), or nil if none exists yet.
    func report(for date: String) async throws -> DailyInsightsReport?
    /// Returns up to `limit` reports for dates strictly before `date`, most recent first.
    func reports(before date: String, limit: Int) async throws -> [DailyInsightsReport]
}

/// `DailyReportRepository` backed by `dailyReports/{uid}/days/{yyyy-MM-dd}`.
@MainActor
final class FirestoreDailyReportRepository: DailyReportRepository {

    private let db = Firestore.firestore()
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore) {
        self.auth = auth
        self.keys = keys
    }

    func report(for date: String) async throws -> DailyInsightsReport? {
        guard let uid = auth.currentUserId else { return nil }
        guard let cipher = keys.currentCipher else { return nil }
        let snap = try await db.collection("dailyReports").document(uid)
            .collection("days").document(date).getDocument()
        guard let data = snap.data() else { return nil }
        return try DailyInsightsReport(firestore: data, cipher: cipher)
    }

    func reports(before date: String, limit: Int) async throws -> [DailyInsightsReport] {
        guard let uid = auth.currentUserId else { return [] }
        guard let cipher = keys.currentCipher else { return [] }
        let snap = try await db.collection("dailyReports").document(uid)
            .collection("days")
            .order(by: "date", descending: true)
            .start(after: [date])
            .limit(to: limit)
            .getDocuments()
        return snap.documents.compactMap { doc in
            try? DailyInsightsReport(firestore: doc.data(), cipher: cipher)
        }
    }
}
