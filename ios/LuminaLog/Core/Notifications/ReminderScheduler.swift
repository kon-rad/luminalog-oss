import Foundation
import OSLog
import UserNotifications

/// Schedules the single next daily-reminder local notification.
@MainActor
protocol ReminderScheduling: AnyObject {
    /// Ask the OS for notification permission. Returns whether it is granted.
    func requestAuthorization() async -> Bool
    /// Cancel the pending reminder; if `fireDate` is non-nil, schedule one
    /// non-repeating notification at that date.
    func reschedule(to fireDate: Date?) async
}

@MainActor
final class ReminderScheduler: ReminderScheduling {

    /// Fixed identifier so each reschedule replaces the previous reminder.
    private static let identifier = "ll-daily-reminder"
    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "reminder")

    nonisolated(unsafe) private let center: UNUserNotificationCenter
    private let timezone: TimeZone

    nonisolated init(center: UNUserNotificationCenter = .current(), timezone: TimeZone = .current) {
        self.center = center
        self.timezone = timezone
    }

    func requestAuthorization() async -> Bool {
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            Self.logger.error("auth request failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    func reschedule(to fireDate: Date?) async {
        center.removePendingNotificationRequests(withIdentifiers: [Self.identifier])
        guard let fireDate else { return }

        let content = UNMutableNotificationContent()
        content.title = "Time for your pages"
        content.body = "A few minutes of journaling keeps your streak alive."
        content.sound = .default

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone
        let components = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute], from: fireDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(
            identifier: Self.identifier, content: content, trigger: trigger
        )
        do {
            try await center.add(request)
        } catch {
            Self.logger.error("schedule failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
