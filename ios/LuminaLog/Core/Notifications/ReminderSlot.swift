import Foundation

/// A single daily-reminder "slot": its notification identifier, the `UserDefaults`
/// keys backing its per-device preferences, its default schedule, and its copy.
/// All slots share `ReminderPlanner` and the 750-word daily-goal gate — they
/// differ only in time, whether they're on by default, and whether the user can
/// edit the time.
struct ReminderSlot: Identifiable {
    /// Notification-request identifier (also namespaces the fixed slots' pref keys).
    let id: String
    /// Settings row label.
    let title: String
    let defaultHour: Int
    let defaultMinute: Int
    let defaultEnabled: Bool
    /// Whether the user can change the fire time (only the primary slot can).
    let timeEditable: Bool
    let notificationTitle: String
    let notificationBody: String
    /// `UserDefaults` keys — explicit so the primary slot can reuse the legacy
    /// `ReminderPrefs` keys and preserve an existing user's setting.
    let enabledKey: String
    let hourKey: String
    let minuteKey: String

    /// The shipped catalog: the existing configurable reminder plus the two
    /// fixed-time (6 PM / 10 PM) reminders that are on by default.
    static let all: [ReminderSlot] = [
        ReminderSlot(
            id: "ll-daily-reminder",
            title: "Daily reminder",
            defaultHour: ReminderPrefs.defaultHour,
            defaultMinute: ReminderPrefs.defaultMinute,
            defaultEnabled: false,
            timeEditable: true,
            notificationTitle: "Time for your pages",
            notificationBody: "A few minutes of journaling keeps your streak alive.",
            enabledKey: ReminderPrefs.enabledKey,
            hourKey: ReminderPrefs.hourKey,
            minuteKey: ReminderPrefs.minuteKey
        ),
        ReminderSlot(
            id: "ll-reminder-evening",
            title: "Evening reminder",
            defaultHour: 18,
            defaultMinute: 0,
            defaultEnabled: true,
            timeEditable: false,
            notificationTitle: "Your pages are waiting",
            notificationBody: "A few minutes of journaling before the evening slips away.",
            enabledKey: "ll-reminder-evening.enabled",
            hourKey: "ll-reminder-evening.hour",
            minuteKey: "ll-reminder-evening.minute"
        ),
        ReminderSlot(
            id: "ll-reminder-night",
            title: "Night reminder",
            defaultHour: 22,
            defaultMinute: 0,
            defaultEnabled: true,
            timeEditable: false,
            notificationTitle: "Last call for today",
            notificationBody: "A few lines now keeps your streak alive.",
            enabledKey: "ll-reminder-night.enabled",
            hourKey: "ll-reminder-night.hour",
            minuteKey: "ll-reminder-night.minute"
        ),
    ]
}
