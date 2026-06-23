import Foundation

/// Goal-gated streak computation shared by the Firestore and mock profile
/// repositories. A day counts toward the streak only once that day's entries
/// total `target` words (summed across entries). Accumulates the day's words
/// and, on the crossing, defers to `StreakCalculator` for the day-adjacency
/// math (yesterday → +1, gap → reset to 1). Also owns the `totalWords` add.
enum DailyGoalStreak {

    static func nextStats(
        current: UserProfile.Stats,
        wordCountDelta: Int,
        entryDate: Date,
        timezone: TimeZone,
        target: Int = DailyGoal.wordTarget
    ) -> UserProfile.Stats {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone

        var next = current
        next.totalWords = current.totalWords + wordCountDelta

        // Accumulate the day's running word total.
        if let day = current.goalDayDate, calendar.isDate(day, inSameDayAs: entryDate) {
            next.goalDayWords = current.goalDayWords + wordCountDelta
        } else {
            next.goalDayDate = entryDate
            next.goalDayWords = wordCountDelta
        }

        let qualifies = next.goalDayWords >= target
        let alreadyCreditedToday = current.lastEntryDate
            .map { calendar.isDate($0, inSameDayAs: entryDate) } ?? false

        // Advance only when the day newly crosses the target.
        if qualifies && !alreadyCreditedToday {
            let advanced = StreakCalculator.nextStats(
                current: current,
                entryDate: entryDate,
                timezone: timezone
            )
            next.streakCount = advanced.streakCount
            next.lastEntryDate = entryDate
        }
        // Otherwise streakCount and lastEntryDate stay as `current`.

        // Best-ever streak — only ever rises (drives the leaderboard ranking).
        next.maxStreakCount = max(current.maxStreakCount, next.streakCount)

        return next
    }
}
