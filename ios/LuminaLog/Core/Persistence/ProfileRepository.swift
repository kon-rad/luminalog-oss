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
    /// Returns `true` if it created the document, `false` if it already existed.
    func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws -> Bool

    /// Merge buffered onboarding answers (`[fieldKey: value]`) into the profile.
    /// When `overwriteExisting` is `true` (a brand-new account) the user's
    /// explicit onboarding answers win over the provider-seeded defaults; when
    /// `false` (a returning/reinstalling user) only currently-empty fields are
    /// filled so existing data is never clobbered.
    func mergeOnboardingDraft(_ draft: [String: String], overwriteExisting: Bool) async throws

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

    /// Atomically increment `stats.promptsAnswered` by 1 when the user saves
    /// an entry that answers a prompt. Best-effort — must not surface to the user.
    func recordPromptAnswered() async throws
}

/// Applies onboarding `draft` onto `profile`. Non-empty draft values are applied;
/// when `overwriteExisting` is `false`, a field is skipped if it already has a
/// value (fill-blanks-only). Returns nil if nothing changed. Shared by every
/// `ProfileRepository` implementation so the merge rule lives in one place.
@MainActor
func applyingOnboardingDraft(
    _ draft: [String: String],
    to profile: UserProfile,
    overwriteExisting: Bool
) -> UserProfile? {
    var updated = profile
    var changed = false
    for field in ProfileFieldCatalog.all {
        guard let raw = draft[field.key] else { continue }
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { continue }
        let current = field.get(profile)
        if overwriteExisting {
            guard value != current else { continue }
        } else {
            guard current.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
        }
        field.set(&updated, value)
        changed = true
    }
    return changed ? updated : nil
}
