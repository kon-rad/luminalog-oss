import Foundation
import SwiftUI

/// Keys for the device-local reminder preferences (notifications are
/// per-device, so they live in `@AppStorage`, not Firestore).
enum ReminderPrefs {
    static let enabledKey = "ll-reminder-enabled"
    static let hourKey = "ll-reminder-hour"
    static let minuteKey = "ll-reminder-minute"
    static let defaultHour = 20
    static let defaultMinute = 0
}

/// Owns the reminder scheduler and re-arms the single next notification when
/// the goal progress, the app foreground state, or the settings change.
@MainActor
final class ReminderCoordinator: ObservableObject {

    private let scheduler: ReminderScheduling
    private let defaults: UserDefaults
    private let now: () -> Date

    nonisolated init(
        scheduler: ReminderScheduling = ReminderScheduler(),
        defaults: UserDefaults = .standard,
        now: @escaping () -> Date = Date.init
    ) {
        self.scheduler = scheduler
        self.defaults = defaults
        self.now = now
    }

    private var enabled: Bool { defaults.bool(forKey: ReminderPrefs.enabledKey) }
    private var hour: Int {
        defaults.object(forKey: ReminderPrefs.hourKey) as? Int ?? ReminderPrefs.defaultHour
    }
    private var minute: Int {
        defaults.object(forKey: ReminderPrefs.minuteKey) as? Int ?? ReminderPrefs.defaultMinute
    }

    /// Whether today's journaling already reached the goal, from the profile.
    private func goalMetToday(profile: UserProfile?, reference: Date) -> Bool {
        guard let stats = profile?.stats, let day = stats.goalDayDate else { return false }
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: profile?.timezone ?? "") { calendar.timeZone = tz }
        return calendar.isDate(day, inSameDayAs: reference)
            && stats.goalDayWords >= DailyGoal.wordTarget
    }

    /// Recompute and (re)schedule the next reminder. Call on profile changes,
    /// scene-active, and settings changes.
    func refresh(profile: UserProfile?) async {
        guard enabled else {
            await scheduler.reschedule(to: nil)
            return
        }
        let reference = now()
        let timezone = TimeZone(identifier: profile?.timezone ?? "") ?? .current
        let fire = ReminderPlanner.nextFireDate(
            now: reference,
            reminderHour: hour,
            reminderMinute: minute,
            goalMetToday: goalMetToday(profile: profile, reference: reference),
            timezone: timezone
        )
        await scheduler.reschedule(to: fire)
    }

    /// Enable reminders: request OS permission, persist the flag, schedule.
    /// Returns whether permission was granted. On denial, leaves enabled=false.
    func enableReminders(profile: UserProfile?) async -> Bool {
        let granted = await scheduler.requestAuthorization()
        defaults.set(granted, forKey: ReminderPrefs.enabledKey)
        if granted { await refresh(profile: profile) }
        return granted
    }

    /// Disable reminders: persist the flag and cancel any pending notification.
    func disableReminders() async {
        defaults.set(false, forKey: ReminderPrefs.enabledKey)
        await scheduler.reschedule(to: nil)
    }
}
