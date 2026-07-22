import Foundation
import SwiftUI
import UserNotifications

/// Legacy keys for the primary reminder's device-local preferences (notifications
/// are per-device, so they live in `UserDefaults`, not Firestore). The primary
/// `ReminderSlot` reuses these so an existing user's setting survives.
enum ReminderPrefs {
    static let enabledKey = "ll-reminder-enabled"
    static let hourKey = "ll-reminder-hour"
    static let minuteKey = "ll-reminder-minute"
    static let defaultHour = 20
    static let defaultMinute = 0
}

/// Owns the reminder scheduler and re-arms every reminder slot's next
/// notification when the goal progress, the app foreground state, or the
/// settings change.
@MainActor
final class ReminderCoordinator: ObservableObject {

    nonisolated(unsafe) private let scheduler: ReminderScheduling
    nonisolated(unsafe) private let defaults: UserDefaults
    nonisolated(unsafe) private let now: () -> Date

    nonisolated init(
        scheduler: ReminderScheduling = ReminderScheduler(),
        defaults: UserDefaults = .standard,
        now: @escaping () -> Date = Date.init
    ) {
        self.scheduler = scheduler
        self.defaults = defaults
        self.now = now
    }

    // MARK: - Per-slot preference accessors

    private func isEnabled(_ slot: ReminderSlot) -> Bool {
        defaults.object(forKey: slot.enabledKey) as? Bool ?? slot.defaultEnabled
    }
    private func hour(_ slot: ReminderSlot) -> Int {
        defaults.object(forKey: slot.hourKey) as? Int ?? slot.defaultHour
    }
    private func minute(_ slot: ReminderSlot) -> Int {
        defaults.object(forKey: slot.minuteKey) as? Int ?? slot.defaultMinute
    }

    /// Whether today's journaling already reached the goal, from the profile.
    private func goalMetToday(profile: UserProfile?, reference: Date) -> Bool {
        guard let stats = profile?.stats, let day = stats.goalDayDate else { return false }
        var calendar = Calendar(identifier: .gregorian)
        if let tz = TimeZone(identifier: profile?.timezone ?? "") { calendar.timeZone = tz }
        return calendar.isDate(day, inSameDayAs: reference)
            && stats.goalDayWords >= DailyGoal.wordTarget
    }

    /// Recompute and (re)schedule every slot's next reminder. Call on profile
    /// changes, scene-active, and settings changes. Requests notification
    /// permission the first time it runs while a reminder is enabled and
    /// authorization is still undetermined.
    func refresh(profile: UserProfile?) async {
        let anyEnabled = ReminderSlot.all.contains { isEnabled($0) }
        var status = await scheduler.authorizationStatus()
        if anyEnabled && status == .notDetermined {
            let granted = await scheduler.requestAuthorization()
            status = granted ? .authorized : .denied
        }
        let authorized = status == .authorized || status == .provisional || status == .ephemeral

        let reference = now()
        let timezone = TimeZone(identifier: profile?.timezone ?? "") ?? .current
        let goalMet = goalMetToday(profile: profile, reference: reference)

        for slot in ReminderSlot.all {
            let fire: Date? = (isEnabled(slot) && authorized)
                ? ReminderPlanner.nextFireDate(
                    now: reference,
                    reminderHour: hour(slot),
                    reminderMinute: minute(slot),
                    goalMetToday: goalMet,
                    timezone: timezone
                )
                : nil
            await scheduler.reschedule(
                identifier: slot.id,
                title: slot.notificationTitle,
                body: slot.notificationBody,
                to: fire
            )
        }
    }

    /// Turn a single reminder slot on or off. Enabling requests OS permission
    /// (persisting whether it was granted) and re-arms all slots; disabling
    /// persists the flag and cancels only that slot. Returns whether the slot
    /// is enabled afterward (i.e. permission granted when enabling).
    @discardableResult
    func setEnabled(_ enabled: Bool, for slot: ReminderSlot, profile: UserProfile?) async -> Bool {
        if enabled {
            let granted = await scheduler.requestAuthorization()
            defaults.set(granted, forKey: slot.enabledKey)
            await refresh(profile: profile)
            return granted
        } else {
            defaults.set(false, forKey: slot.enabledKey)
            await scheduler.reschedule(
                identifier: slot.id,
                title: slot.notificationTitle,
                body: slot.notificationBody,
                to: nil
            )
            return false
        }
    }
}
