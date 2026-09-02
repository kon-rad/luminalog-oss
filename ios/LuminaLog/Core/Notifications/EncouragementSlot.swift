import Foundation

/// Device-local preference for the whole daily-encouragement feature. Like the
/// journaling reminders, notifications are per-device, so this lives in
/// `UserDefaults` rather than Firestore. On by default; turning it off cancels
/// the pending notifications AND skips the morning AI request entirely.
enum EncouragementPrefs {
    static let enabledKey = "ll-encouragement.enabled"
    static let defaultEnabled = true
}

/// One of the three fixed delivery times for AI encouragement messages.
///
/// The times deliberately avoid the existing journaling reminders (6 PM evening,
/// 10 PM night) so the user never receives two Argo notifications at once. Unlike
/// `ReminderSlot` these carry no copy: title and body come from the generated
/// message assigned to the slot that day.
struct EncouragementSlot: Identifiable, Equatable {
    /// Notification-request identifier. Reused daily so rescheduling overwrites
    /// rather than duplicating.
    let id: String
    let hour: Int
    let minute: Int

    static let all: [EncouragementSlot] = [
        EncouragementSlot(id: "ll-encouragement-1", hour: 9, minute: 0),
        EncouragementSlot(id: "ll-encouragement-2", hour: 13, minute: 0),
        EncouragementSlot(id: "ll-encouragement-3", hour: 16, minute: 0),
    ]
}
