import Foundation

/// One message assigned to one slot at one concrete fire time.
struct EncouragementAssignment: Equatable {
    let slotId: String
    let fireDate: Date
    let message: EncouragementMessage
}

/// Pure scheduling math for the daily encouragement notifications. No Firestore,
/// no `UNUserNotificationCenter`, no clock: everything is passed in, so the
/// rotation rules are fully unit-testable.
enum EncouragementPlanner {

    /// Undelivered messages created more than `EncouragementExpiry.days` before
    /// `now`. These are pruned so the queue stays bounded: five arrive each
    /// morning, three are delivered, and the rest age out.
    static func expired(_ queue: [EncouragementMessage], now: Date) -> [EncouragementMessage] {
        guard let cutoff = Calendar(identifier: .gregorian).date(
            byAdding: .day, value: -EncouragementExpiry.days, to: now
        ) else { return [] }
        return queue.filter { !$0.isDelivered && $0.createdAt < cutoff }
    }

    /// Assigns the oldest undelivered messages to today's remaining slots.
    ///
    /// Rotation: the queue is sorted oldest first, so yesterday's leftovers fire
    /// before this morning's fresh batch. Only slots strictly ahead of `now` are
    /// scheduled, which makes a mid-day run (the foreground catch-up path) fill
    /// just the slots that have not passed.
    static func plan(
        now: Date,
        queue: [EncouragementMessage],
        slots: [EncouragementSlot],
        timezone: TimeZone
    ) -> [EncouragementAssignment] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone

        let pending = queue
            .filter { !$0.isDelivered }
            .sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
        guard !pending.isEmpty else { return [] }

        var assignments: [EncouragementAssignment] = []
        var next = pending.makeIterator()

        for slot in slots {
            guard let fire = calendar.date(
                bySettingHour: slot.hour, minute: slot.minute, second: 0, of: now
            ), fire > now else { continue }
            guard let message = next.next() else { break }
            assignments.append(
                EncouragementAssignment(slotId: slot.id, fireDate: fire, message: message)
            )
        }
        return assignments
    }
}
