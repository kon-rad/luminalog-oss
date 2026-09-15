import Foundation
import OSLog
import SwiftUI
import UserNotifications

/// Runs Mirror's daily cycle: generate today's three time-of-day Echoes, store
/// them encrypted, and arm whichever of the day's notification slots are still
/// ahead of now.
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
        guard await ensureNotificationPermission() else { return }

        let reference = now()
        let timezone = TimeZone(identifier: profile?.timezone ?? "") ?? .current
        let key = Self.dateKey(reference, timezone: timezone)

        do {
            try await generateBatchIfNeeded(dateKey: key, reference: reference)

            let today = try await repository.messages(forDateKey: key)
            let plan = EncouragementPlanner.plan(
                now: reference, today: today, slots: EncouragementSlot.all, timezone: timezone
            )
            try await arm(plan)
        } catch {
            Self.logger.error("cycle failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Private

    /// True once the OS has granted permission. Unlike a plain status check,
    /// this also REQUESTS permission the first time it sees `.notDetermined`:
    /// the feature defaults to on (see `EncouragementPrefs`) and the Settings
    /// toggle is rarely touched, so this cycle is often the only place that
    /// would ever trigger the system prompt. Safe to call on every cycle:
    /// once the user has answered, iOS returns the cached answer instead of
    /// prompting again.
    private func ensureNotificationPermission() async -> Bool {
        switch await scheduler.authorizationStatus() {
        case .authorized, .provisional, .ephemeral:
            return true
        case .notDetermined:
            return await scheduler.requestAuthorization()
        default:
            return false
        }
    }

    /// Calls the AI at most once per local day. Nothing is written when the model
    /// had nothing to ground any slot in, so the next foreground retries rather
    /// than banking a day of silence.
    private func generateBatchIfNeeded(dateKey: String, reference: Date) async throws {
        if try await repository.hasBatch(forDateKey: dateKey) { return }

        let echoes = try await ai.generateMirrorEchoes()
        let messages = EncouragementSlot.all.compactMap { slot -> EncouragementMessage? in
            guard let text = echoes.text(for: slot.timeOfDay)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !text.isEmpty else { return nil }
            return EncouragementMessage(
                id: EncouragementIds.documentId(dateKey: dateKey, timeOfDay: slot.timeOfDay),
                timeOfDay: slot.timeOfDay,
                text: text,
                createdAt: reference,
                deliveredAt: nil
            )
        }
        guard !messages.isEmpty else { return }
        try await repository.save(messages)
    }

    /// Arms each planned slot and cancels any slot the plan did not fill, so a
    /// missed or ungrounded slot never leaves a stale notification pending from
    /// an earlier run. The notification title is always the static feature
    /// name; the model-generated text is the body only.
    private func arm(_ plan: [EncouragementAssignment]) async throws {
        let assigned = Dictionary(uniqueKeysWithValues: plan.map { ($0.slotId, $0) })
        for slot in EncouragementSlot.all {
            guard let assignment = assigned[slot.id] else {
                await scheduler.reschedule(identifier: slot.id, title: "", body: "", to: nil)
                continue
            }
            await scheduler.reschedule(
                identifier: slot.id,
                title: EncouragementPrefs.displayName,
                body: assignment.message.text,
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
