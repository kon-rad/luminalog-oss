import Foundation
import OSLog
import UserNotifications

/// Schedules the next local notification for a single reminder slot, keyed by
/// its notification identifier so each slot is scheduled independently.
@MainActor
protocol ReminderScheduling: AnyObject {
    /// Ask the OS for notification permission. Returns whether it is granted.
    func requestAuthorization() async -> Bool
    /// The current OS notification-authorization status (drives the
    /// request-on-first-foreground behavior).
    func authorizationStatus() async -> UNAuthorizationStatus
    /// Cancel the pending notification for `identifier`; if `fireDate` is
    /// non-nil, schedule one non-repeating notification at that date.
    func reschedule(identifier: String, title: String, body: String, to fireDate: Date?) async
}

@MainActor
final class ReminderScheduler: ReminderScheduling {

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

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    func reschedule(identifier: String, title: String, body: String, to fireDate: Date?) async {
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        guard let fireDate else { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone
        let components = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute], from: fireDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(
            identifier: identifier, content: content, trigger: trigger
        )
        do {
            try await center.add(request)
        } catch {
            Self.logger.error("schedule failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
