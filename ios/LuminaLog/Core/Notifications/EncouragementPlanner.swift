import Foundation

/// One message assigned to one slot at one concrete fire time.
struct EncouragementAssignment: Equatable {
    let slotId: String
    let fireDate: Date
    let message: EncouragementMessage
}

/// Pure scheduling math for Mirror's notifications. No Firestore, no
/// `UNUserNotificationCenter`, no clock: everything is passed in, so the
/// mapping is fully unit-testable.
enum EncouragementPlanner {

    /// Maps today's already-generated echoes onto the slots whose fire time is
    /// still ahead of `now`. A slot with no matching `timeOfDay` message (the AI
    /// had nothing to ground it in that day) or whose fire time has already
    /// passed is omitted; the coordinator cancels whatever is not in the result,
    /// so a missed slot is simply skipped rather than back-filled or rolled over.
    static func plan(
        now: Date,
        today: [EncouragementMessage],
        slots: [EncouragementSlot],
        timezone: TimeZone
    ) -> [EncouragementAssignment] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone
        let byTimeOfDay = Dictionary(uniqueKeysWithValues: today.map { ($0.timeOfDay, $0) })

        return slots.compactMap { slot in
            guard let fire = calendar.date(
                bySettingHour: slot.hour, minute: slot.minute, second: 0, of: now
            ), fire > now, let message = byTimeOfDay[slot.timeOfDay] else { return nil }
            return EncouragementAssignment(slotId: slot.id, fireDate: fire, message: message)
        }
    }
}
