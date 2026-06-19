import Foundation

/// Pure scheduling math for the smart daily reminder. Returns the next
/// datetime the reminder should fire, or nil if it should not be scheduled.
enum ReminderPlanner {

    static func nextFireDate(
        now: Date,
        reminderHour: Int,
        reminderMinute: Int,
        goalMetToday: Bool,
        timezone: TimeZone
    ) -> Date? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone

        guard let todayFire = calendar.date(
            bySettingHour: reminderHour,
            minute: reminderMinute,
            second: 0,
            of: now
        ) else { return nil }

        // Today only if the goal is still open AND the time is strictly ahead.
        if !goalMetToday && todayFire > now {
            return todayFire
        }
        return calendar.date(byAdding: .day, value: 1, to: todayFire)
    }
}
