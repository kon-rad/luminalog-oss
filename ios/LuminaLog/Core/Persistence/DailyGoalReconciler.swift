import Foundation
import OSLog

/// App-level observer that keeps the persisted daily-goal progress
/// (`stats.goalDayWords`) and the goal-gated streak in sync with the source of
/// truth — the journal entries created today.
///
/// It runs for the whole signed-in session (started from `LuminaLogApp`'s
/// per-uid `.task`), independent of which screen is visible. Because it watches
/// `entriesToday`, EVERY entry mutation — create, edit, delete, and crucially a
/// transcript retry on the Journal Detail screen — triggers a reconcile. This is
/// the single trigger point that replaced the old per-call-site delta bookkeeping
/// (whose forgotten call on the retry path under-counted today's words).
///
/// The reconcile is idempotent: it sets `goalDayWords` to the recomputed total
/// and advances the streak only on the crossing, so it can run as often as the
/// stream emits without drift.
@MainActor
final class DailyGoalReconciler {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "daily-goal")

    private let journals: JournalRepository
    private let profiles: ProfileRepository

    init(journals: JournalRepository, profiles: ProfileRepository) {
        self.journals = journals
        self.profiles = profiles
    }

    /// Learns the user's timezone from the first non-nil profile emission (which
    /// also guarantees the decryption key is loaded, so `entriesToday` won't
    /// spuriously yield an empty snapshot), then reconciles today's goal total on
    /// every change to today's entries. Awaiting this keeps it alive; cancelling
    /// the enclosing task (sign-out / uid change) stops it and tears down the
    /// listeners.
    func run() async {
        var timezone = TimeZone.current
        for await profile in profiles.profile() {
            if let profile {
                timezone = TimeZone(identifier: profile.timezone) ?? .current
                break
            }
        }
        guard !Task.isCancelled else { return }

        for await entries in journals.entriesToday(timezone: timezone) {
            if Task.isCancelled { return }
            let now = Date()
            let total = TodayWords.total(from: entries, timezone: timezone, now: now)
            do {
                try await profiles.reconcileDailyGoal(todayTotal: total, now: now)
            } catch {
                Self.logger.error("reconcileDailyGoal failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
