import Foundation

/// Pure streak computation shared by the Firestore and mock profile
/// repositories (spec §3): increment the streak if the previous entry was
/// yesterday in the user's timezone, keep it if it was today, otherwise
/// reset to 1. `totalWords` is left untouched — callers add their delta.
enum StreakCalculator {

    static func nextStats(
        current: UserProfile.Stats,
        entryDate: Date,
        timezone: TimeZone
    ) -> UserProfile.Stats {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone

        var next = current
        next.lastEntryDate = entryDate

        guard let last = current.lastEntryDate else {
            next.streakCount = 1
            return next
        }

        if calendar.isDate(last, inSameDayAs: entryDate) {
            // Another entry today — streak unchanged (but never below 1).
            next.streakCount = max(current.streakCount, 1)
        } else if let yesterday = calendar.date(byAdding: .day, value: -1, to: entryDate),
                  calendar.isDate(last, inSameDayAs: yesterday) {
            next.streakCount = current.streakCount + 1
        } else {
            next.streakCount = 1
        }
        return next
    }
}
