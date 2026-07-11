import Foundation

/// Goal-gated streak computation shared by the Firestore and mock profile
/// repositories. A day counts toward the streak only once that day's entries
/// total `target` words.
///
/// This is driven by an **authoritative recompute**, not a delta: callers pass
/// the current day's full word total (`todayTotal`, from `TodayWords`). We set
/// `goalDayWords = todayTotal` for today and, on the crossing, defer to
/// `StreakCalculator` for the day-adjacency math (yesterday → +1, gap → reset to
/// 1). Because it *sets* rather than *accumulates*, a retried transcription,
/// edit, or delete that changes today's total simply reconciles to the correct
/// value with no drift.
///
/// `totalWords` (the lifetime odometer) is NOT touched here — it stays a
/// separate delta counter owned by `ProfileRepository.addTotalWords`.
enum DailyGoalStreak {

    static func reconciled(
        current: UserProfile.Stats,
        todayTotal: Int,
        now: Date,
        timezone: TimeZone,
        target: Int = DailyGoal.wordTarget
    ) -> UserProfile.Stats {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone

        var next = current

        // goalDayWords is authoritative for today's day.
        next.goalDayDate = now
        next.goalDayWords = todayTotal

        let qualifies = todayTotal >= target
        let alreadyCreditedToday = current.lastEntryDate
            .map { calendar.isDate($0, inSameDayAs: now) } ?? false

        // Advance only when the day newly crosses the target. Once credited, a
        // later reconcile to a lower total (e.g. a delete) never regresses the
        // streak — the day already earned its credit.
        if qualifies && !alreadyCreditedToday {
            let advanced = StreakCalculator.nextStats(
                current: current,
                entryDate: now,
                timezone: timezone
            )
            next.streakCount = advanced.streakCount
            next.lastEntryDate = now
        }
        // Otherwise streakCount and lastEntryDate stay as `current`.

        // Best-ever streak — only ever rises (drives the leaderboard ranking).
        next.maxStreakCount = max(current.maxStreakCount, next.streakCount)

        return next
    }
}
