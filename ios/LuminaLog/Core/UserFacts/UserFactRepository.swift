import Foundation
import FirebaseFirestore
import OSLog

protocol UserFactRepository: AnyObject {
    /// Every fact, tombstones included. [] when signed out or the key is unavailable.
    /// Undecodable docs are skipped.
    func all() async throws -> [UserFact]
    /// Writes (replaces) the doc at `fact.id`.
    func save(_ fact: UserFact) async throws
    /// Hard delete. Used for a fact whose every source entry was deleted.
    func delete(id: String) async throws
    /// Hard-deletes every fact, tombstones included ("Forget everything").
    func deleteAll() async throws
    /// The extraction bookkeeping. The default state when none is stored or signed out.
    func state() async throws -> UserFactExtractionState
    func saveState(_ state: UserFactExtractionState) async throws
}

enum UserFactRepositoryError: Error {
    case signedOut
    case keyUnavailable
}

/// `UserFactRepository` backed by `userFacts/{uid}/facts/{id}` and
/// `userFacts/{uid}/state/extraction`.
@MainActor
final class FirestoreUserFactRepository: UserFactRepository {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "user-facts")

    private let db = Firestore.firestore()
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore) {
        self.auth = auth
        self.keys = keys
    }

    private func facts(_ uid: String) -> CollectionReference {
        db.collection("userFacts").document(uid).collection("facts")
    }

    private func stateDoc(_ uid: String) -> DocumentReference {
        db.collection("userFacts").document(uid).collection("state").document("extraction")
    }

    func all() async throws -> [UserFact] {
        guard let uid = auth.currentUserId, let cipher = keys.currentCipher else { return [] }
        let snap = try await facts(uid).getDocuments()
        return snap.documents.compactMap { doc in
            do {
                return try UserFact(firestore: doc.data(), id: doc.documentID, cipher: cipher)
            } catch {
                Self.logger.error("skipping undecodable user fact \(doc.documentID, privacy: .public)")
                return nil
            }
        }
    }

    func save(_ fact: UserFact) async throws {
        guard let uid = auth.currentUserId else { throw UserFactRepositoryError.signedOut }
        guard let cipher = keys.currentCipher else { throw UserFactRepositoryError.keyUnavailable }
        try await facts(uid).document(fact.id).setData(try fact.firestoreData(cipher: cipher))
    }

    func delete(id: String) async throws {
        guard let uid = auth.currentUserId else { throw UserFactRepositoryError.signedOut }
        try await facts(uid).document(id).delete()
    }

    func deleteAll() async throws {
        guard let uid = auth.currentUserId else { throw UserFactRepositoryError.signedOut }
        let docs = try await facts(uid).getDocuments().documents
        // A write batch holds at most 500 operations.
        for start in stride(from: 0, to: docs.count, by: 400) {
            let batch = db.batch()
            for doc in docs[start..<min(start + 400, docs.count)] {
                batch.deleteDocument(doc.reference)
            }
            try await batch.commit()
        }
    }

    func state() async throws -> UserFactExtractionState {
        guard let uid = auth.currentUserId else { return UserFactExtractionState() }
        let snap = try await stateDoc(uid).getDocument()
        return UserFactExtractionState(firestore: snap.data() ?? [:])
    }

    func saveState(_ state: UserFactExtractionState) async throws {
        guard let uid = auth.currentUserId else { throw UserFactRepositoryError.signedOut }
        try await stateDoc(uid).setData(state.firestoreData())
    }
}
