import Foundation
import FirebaseFirestore
import OSLog

protocol PeriodSummaryRepository: AnyObject {
    /// Every stored summary for the signed-in user. [] when signed out or the key
    /// is unavailable. Undecodable docs are skipped (and so get regenerated).
    func all() async throws -> [PeriodSummary]
    /// The stored summaries among `periods`; missing ones are simply absent.
    func summaries(for periods: [PeriodKey]) async throws -> [PeriodSummary]
    /// Writes (overwrites) the doc at `summary.key.docId`.
    func save(_ summary: PeriodSummary) async throws
    func delete(_ key: PeriodKey) async throws
}

enum PeriodSummaryRepositoryError: Error {
    case signedOut
    case keyUnavailable
}

/// `PeriodSummaryRepository` backed by `periodSummaries/{uid}/tiers/{type}_{index}`.
@MainActor
final class FirestorePeriodSummaryRepository: PeriodSummaryRepository {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "period-summaries")

    private let db = Firestore.firestore()
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore) {
        self.auth = auth
        self.keys = keys
    }

    private func tiers(_ uid: String) -> CollectionReference {
        db.collection("periodSummaries").document(uid).collection("tiers")
    }

    func all() async throws -> [PeriodSummary] {
        guard let uid = auth.currentUserId, let cipher = keys.currentCipher else { return [] }
        let snap = try await tiers(uid).getDocuments()
        return snap.documents.compactMap { doc in
            do {
                return try PeriodSummary(firestore: doc.data(), id: doc.documentID, cipher: cipher)
            } catch {
                Self.logger.error("skipping undecodable period summary \(doc.documentID, privacy: .public)")
                return nil
            }
        }
    }

    func summaries(for periods: [PeriodKey]) async throws -> [PeriodSummary] {
        guard let uid = auth.currentUserId, let cipher = keys.currentCipher else { return [] }
        var found: [PeriodSummary] = []
        for key in periods {
            let doc = try await tiers(uid).document(key.docId).getDocument()
            guard let data = doc.data(),
                  let summary = try? PeriodSummary(firestore: data, id: doc.documentID, cipher: cipher) else { continue }
            found.append(summary)
        }
        return found
    }

    func save(_ summary: PeriodSummary) async throws {
        guard let uid = auth.currentUserId else { throw PeriodSummaryRepositoryError.signedOut }
        guard let cipher = keys.currentCipher else { throw PeriodSummaryRepositoryError.keyUnavailable }
        try await tiers(uid).document(summary.key.docId).setData(try summary.firestoreData(cipher: cipher))
    }

    func delete(_ key: PeriodKey) async throws {
        guard let uid = auth.currentUserId else { throw PeriodSummaryRepositoryError.signedOut }
        try await tiers(uid).document(key.docId).delete()
    }
}
