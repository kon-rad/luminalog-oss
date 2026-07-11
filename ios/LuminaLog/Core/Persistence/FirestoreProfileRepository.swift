import Foundation
import OSLog
import FirebaseFirestore

/// `ProfileRepository` backed by `users/{uid}` (spec §3).
@MainActor
final class FirestoreProfileRepository: ProfileRepository {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "firestore")

    private let db: Firestore
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore, db: Firestore = .firestore()) {
        self.auth = auth
        self.keys = keys
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
                guard let cipher = self.keys.currentCipher else {
                    continuation.yield(nil); return
                }
                if let data = snapshot.data() {
                    continuation.yield(UserProfile(documentId: snapshot.documentID, data: data, cipher: cipher))
                } else {
                    continuation.yield(nil)
                }
            }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func update(_ profile: UserProfile) async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        // Merge so proxy-written fields are never clobbered by a stale client copy.
        try await userRef(uid).setData(try profile.firestoreData(cipher: cipher), merge: true)
    }

    @discardableResult
    func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws -> Bool {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        let ref = userRef(uid)
        let snapshot = try await ref.getDocument()
        // Never overwrite an existing document — returning users keep their
        // biography, stats, and any proxy-written fields.
        guard !snapshot.exists else { return false }

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
        try await ref.setData(try seed.firestoreData(cipher: cipher), merge: true)
        return true
    }

    func mergeOnboardingDraft(_ draft: [String: String], overwriteExisting: Bool) async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        // Read the live doc so we merge against server truth, not a stale copy.
        let snapshot = try await userRef(uid).getDocument()
        guard let data = snapshot.data() else { return }
        let current = UserProfile(documentId: snapshot.documentID, data: data, cipher: cipher)
        guard let updated = applyingOnboardingDraft(draft, to: current, overwriteExisting: overwriteExisting) else { return }
        try await userRef(uid).setData(try updated.firestoreData(cipher: cipher), merge: true)
    }

    func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        let countKey: String
        let bytesKey: String
        switch kind {
        case .audio: countKey = "storage.audioCount"; bytesKey = "storage.audioBytes"
        case .image: countKey = "storage.imageCount"; bytesKey = "storage.imageBytes"
        case .video: countKey = "storage.videoCount"; bytesKey = "storage.videoBytes"
        }
        try await userRef(uid).updateData([
            countKey: FieldValue.increment(Int64(1)),
            bytesKey: FieldValue.increment(Int64(bytes)),
        ])
    }

    func recordTimeSpent(minutes: Int) async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        try await userRef(uid).updateData([
            "totalMinutesInApp": FieldValue.increment(Int64(minutes))
        ])
    }

    func recordPromptAnswered() async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        try await userRef(uid).updateData([
            "stats.promptsAnswered": FieldValue.increment(Int64(1))
        ])
    }

    func recordSoulConsent(_ granted: Bool) async throws {
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        // Plaintext operational flag on the users doc (not secret) — the server gates
        // public-Soul minting on `consent.soulPublicNft`. setData(merge:) so the nested
        // map + server timestamp are written whether or not the field already exists.
        try await userRef(uid).setData([
            "consent": [
                "soulPublicNft": granted,
                "version": "1",
                "acceptedAt": FieldValue.serverTimestamp(),
            ]
        ], merge: true)
    }

    func addTotalWords(delta: Int) async throws {
        guard delta != 0 else { return }
        guard let uid = auth.currentUserId else { throw AuthServiceError.notSignedIn }
        try await userRef(uid).updateData([
            "stats.totalWords": FieldValue.increment(Int64(delta))
        ])
    }

    func reconcileDailyGoal(todayTotal: Int, now: Date) async throws {
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

            let next = DailyGoalStreak.reconciled(
                current: current,
                todayTotal: todayTotal,
                now: now,
                timezone: timezone
            )

            transaction.setData(["stats": next.firestoreData], forDocument: ref, merge: true)
            return nil
        }
    }
}
