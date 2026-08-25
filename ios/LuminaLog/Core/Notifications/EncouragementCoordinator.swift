import Foundation
import OSLog
import SwiftUI
import UserNotifications

/// Runs the daily encouragement cycle: generate the morning batch, store it
/// encrypted, prune what aged out, and arm the day's remaining notification slots.
///
/// The cycle is idempotent. It runs from two places: the 5 AM `BGAppRefreshTask`
/// and every scene-active transition (the catch-up path, since iOS may run the
/// background task late or not at all). Running it twice in one day performs no
/// second AI call and re-arms the same slot identifiers rather than duplicating
/// notifications.
@MainActor
final class EncouragementCoordinator: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "encouragement")

    private let ai: AIService
    private let repository: EncouragementRepository
    private let scheduler: ReminderScheduling
    private let defaults: UserDefaults
    private let now: () -> Date

    init(
        ai: AIService,
        repository: EncouragementRepository,
        scheduler: ReminderScheduling = ReminderScheduler(),
        defaults: UserDefaults = .standard,
        now: @escaping () -> Date = Date.init
    ) {
        self.ai = ai
        self.repository = repository
        self.scheduler = scheduler
        self.defaults = defaults
        self.now = now
    }

    var isEnabled: Bool {
        defaults.object(forKey: EncouragementPrefs.enabledKey) as? Bool
            ?? EncouragementPrefs.defaultEnabled
    }

    /// Turn the feature on or off. Enabling requests OS permission and runs the
    /// cycle; disabling persists the flag and cancels every pending slot without
    /// touching stored messages. Returns whether it is enabled afterward.
    @discardableResult
    func setEnabled(_ enabled: Bool, profile: UserProfile?) async -> Bool {
        guard enabled else {
            defaults.set(false, forKey: EncouragementPrefs.enabledKey)
            await cancelAllSlots()
            return false
        }
        let granted = await scheduler.requestAuthorization()
        defaults.set(granted, forKey: EncouragementPrefs.enabledKey)
        if granted { await runCycle(profile: profile) }
        return granted
    }

    /// The full daily cycle. Safe to call on every foreground.
    func runCycle(profile: UserProfile?) async {
        guard isEnabled else {
            await cancelAllSlots()
            return
        }
        guard await hasNotificationPermission() else { return }

        let reference = now()
        let timezone = TimeZone(identifier: profile?.timezone ?? "") ?? .current

        do {
            try await generateBatchIfNeeded(reference: reference, timezone: timezone)

            var queue = try await repository.undelivered()

            let stale = EncouragementPlanner.expired(queue, now: reference)
            if !stale.isEmpty {
                let cutoff = Calendar(identifier: .gregorian)
                    .date(byAdding: .day, value: -EncouragementExpiry.days, to: reference) ?? reference
                try await repository.deleteExpired(createdBefore: cutoff)
                let staleIds = Set(stale.map(\.id))
                queue.removeAll { staleIds.contains($0.id) }
            }

            let plan = EncouragementPlanner.plan(
                now: reference, queue: queue, slots: EncouragementSlot.all, timezone: timezone
            )
            try await arm(plan)
        } catch {
            Self.logger.error("cycle failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Private

    private func hasNotificationPermission() async -> Bool {
        let status = await scheduler.authorizationStatus()
        return status == .authorized || status == .provisional || status == .ephemeral
    }

    /// Calls the AI at most once per local day. Nothing is written when the model
    /// returns no messages, so the next foreground retries rather than banking a
    /// day of silence.
    private func generateBatchIfNeeded(reference: Date, timezone: TimeZone) async throws {
        let key = Self.dateKey(reference, timezone: timezone)
        if try await repository.hasBatch(forDateKey: key) { return }

        let generated = try await ai.generateEncouragements()
        guard !generated.isEmpty else { return }

        let messages = generated.enumerated().map { index, item in
            EncouragementMessage(
                id: EncouragementIds.documentId(dateKey: key, generatedAt: reference, index: index),
                title: item.title,
                body: item.body,
                createdAt: reference,
                deliveredAt: nil
            )
        }
        try await repository.save(messages)
    }

    /// Arms each planned slot and cancels any slot the plan did not fill, so a
    /// shorter queue never leaves a stale notification pending from an earlier run.
    private func arm(_ plan: [EncouragementAssignment]) async throws {
        let assigned = Dictionary(uniqueKeysWithValues: plan.map { ($0.slotId, $0) })
        for slot in EncouragementSlot.all {
            guard let assignment = assigned[slot.id] else {
                await scheduler.reschedule(identifier: slot.id, title: "", body: "", to: nil)
                continue
            }
            await scheduler.reschedule(
                identifier: slot.id,
                title: assignment.message.title,
                body: assignment.message.body,
                to: assignment.fireDate
            )
            try await repository.markDelivered(id: assignment.message.id, at: assignment.fireDate)
        }
    }

    private func cancelAllSlots() async {
        for slot in EncouragementSlot.all {
            await scheduler.reschedule(identifier: slot.id, title: "", body: "", to: nil)
        }
    }

    /// "yyyy-MM-dd" in the user's timezone, matching the server's date keys.
    private static func dateKey(_ date: Date, timezone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timezone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
