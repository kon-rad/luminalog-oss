import Foundation
import OSLog
import FirebaseFirestore

/// `ProfileRepository` backed by `users/{uid}` (spec §3).
@MainActor
final class FirestoreProfileRepository: ProfileRepository {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "firestore")

    private let db: Firestore
    private let auth: AuthService

    init(auth: AuthService, db: Firestore = .firestore()) {
        self.auth = auth
        self.db = db
    }

    private func userRef(_ uid: String) -> DocumentReference {
        db.collection("users").document(uid)
    }

    // MARK: - ProfileRepository

    func profile() -> AsyncStream<UserProfile?> {
        AsyncStream { continuation in
            guard let uid = self.auth.currentUserId else {
                continuation.yield(nil)
                continuation.finish()
                return
            }
            let listener = self.userRef(uid).addSnapshotListener { snapshot, error in
                guard let snapshot else {
                    // Keep the stream alive; the listener recovers on the
                    // next good snapshot (see protocol stream convention).
                    Self.logger.error("""
                    profile listener error (users/\(uid, privacy: .private)): \
                    \(error?.localizedDescription ?? "unknown", privacy: .public)
                    """)
                    return
                }
                if let data = snapshot.data() {
                    continuation.yield(UserProfile(documentId: snapshot.documentID, data: data))
                } else {
                    continuation.yield(nil)
                }
            }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func update(_ profile: UserProfile) async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        // Merge so proxy-written fields are never clobbered by a stale client copy.
        try await userRef(uid).setData(profile.firestoreData, merge: true)
    }

    func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        let ref = userRef(uid)
        let snapshot = try await ref.getDocument()
        // Never overwrite an existing document — returning users keep their
        // biography, stats, and any proxy-written fields.
        guard !snapshot.exists else { return }

        let seed = UserProfile(
            id: uid,
            displayName: displayName ?? "",
            email: email ?? "",
            photoURL: photoURL,
            biography: "",
            createdAt: Date(),
            timezone: TimeZone.current.identifier,
            stats: UserProfile.Stats()
        )
        // Merge so a concurrent first sign-in (or a proxy write racing the
        // exists-check above) can't be clobbered by this seed.
        try await ref.setData(seed.firestoreData, merge: true)
    }

    func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        let ref = userRef(uid)

        _ = try await db.runTransaction { transaction, errorPointer in
            let snapshot: DocumentSnapshot
            do {
                snapshot = try transaction.getDocument(ref)
            } catch {
                errorPointer?.pointee = error as NSError
                return nil
            }

            let data = snapshot.data() ?? [:]
            let current = UserProfile.Stats(data: data["stats"] as? [String: Any] ?? [:])
            let timezone = (data["timezone"] as? String).flatMap(TimeZone.init(identifier:))
                ?? .current

            var next = StreakCalculator.nextStats(
                current: current,
                entryDate: date,
                timezone: timezone
            )
            next.totalWords = current.totalWords + wordCountDelta

            transaction.setData(["stats": next.firestoreData], forDocument: ref, merge: true)
            return nil
        }
    }
}
