import Foundation

/// Read/write access to the signed-in user's profile (`users/{uid}`).
@MainActor
protocol ProfileRepository: AnyObject {

    /// Live-updating stream of the user profile; nil while it does not exist.
    ///
    /// Streams never throw: backend errors are logged and the stream stays
    /// silent until the next good snapshot. Streams capture the user at
    /// creation and must be re-created on auth changes.
    func profile() -> AsyncStream<UserProfile?>

    /// Persist profile edits (displayName, biography, photo, dailyPrompt, ...).
    func update(_ profile: UserProfile) async throws

    /// Create `users/{uid}` if it does not exist yet (first sign-in), seeded
    /// with provider info and `UserProfile` defaults (empty biography, zeroed
    /// stats, current timezone). Never overwrites an existing document.
    func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws

    /// Transactionally update `stats` after a journal save: add the word-count
    /// delta and advance the streak only when the day's words reach the daily
    /// goal, per `DailyGoalStreak` (spec §3).
    func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws

    /// Atomically increment the media storage counters for one successfully
    /// uploaded file. Failures are best-effort — they must not surface to the user.
    func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws

    /// Atomically add `minutes` to the user's cumulative in-app time.
    /// Failures are best-effort — they must not surface to the user.
    func recordTimeSpent(minutes: Int) async throws
}
