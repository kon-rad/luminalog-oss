import Foundation

/// Device-local preference for the whole Mirror feature. Like the journaling
/// reminders, notifications are per-device, so this lives in `UserDefaults`
/// rather than Firestore. On by default; turning it off cancels the pending
/// notifications AND skips the morning AI request entirely.
enum EncouragementPrefs {
    static let enabledKey = "ll-encouragement.enabled"
    static let defaultEnabled = true
    /// User-facing feature name: the Settings toggle, the notification title,
    /// and the history screen all read this one constant.
    static let displayName = "Mirror"
}

/// One of the three fixed delivery times for Mirror's Echo notifications.
///
/// The times deliberately avoid the existing journaling reminders (6 PM evening,
/// 10 PM night) so the user never receives two Argo notifications at once. Each
/// slot's `timeOfDay` picks which of the day's three generated echoes fires
/// into it (see `EncouragementPlanner`); the sentence itself comes from the
/// message assigned to the slot that day, not from static copy here.
struct EncouragementSlot: Identifiable, Equatable {
    /// Notification-request identifier. Reused daily so rescheduling overwrites
    /// rather than duplicating.
    let id: String
    let hour: Int
    let minute: Int
    let timeOfDay: TimeOfDay

    static let all: [EncouragementSlot] = [
        EncouragementSlot(id: "ll-encouragement-1", hour: 9, minute: 0, timeOfDay: .morning),
        EncouragementSlot(id: "ll-encouragement-2", hour: 13, minute: 0, timeOfDay: .afternoon),
        EncouragementSlot(id: "ll-encouragement-3", hour: 16, minute: 0, timeOfDay: .evening),
    ]
}
