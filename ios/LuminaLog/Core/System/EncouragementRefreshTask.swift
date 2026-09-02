import BackgroundTasks
import Foundation
import OSLog

/// Registration and scheduling for the pre-dawn encouragement refresh.
///
/// `BGAppRefreshTask` is OPPORTUNISTIC: iOS decides when to run it based on the
/// user's launch history, budget, and power state. `earliestBeginDate` is a floor,
/// not an appointment, so a user who never opens the app around dawn may see it
/// run late or not at all. `EncouragementCoordinator.runCycle` therefore also runs
/// on every scene-active transition, and only schedules slots still ahead of now.
enum EncouragementRefreshTask {

    static let identifier = "com.konradgnat.luminalog.encouragement.refresh"

    /// How long the launch handler waits for the observing view to run the cycle
    /// before it reports completion. Well inside the ~30s an app-refresh task gets.
    static let handlerBudget: Duration = .seconds(20)

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "encouragement")

    /// Registers the launch handler. Must be called before the app finishes
    /// launching, so this belongs in `AppDelegate.application(_:didFinishLaunching…)`.
    /// The handler always re-schedules the next run first, so the chain survives an
    /// early expiration, and calls `setTaskCompleted` exactly once.
    static func register(handler work: @escaping @Sendable () async -> Void) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            schedule()
            let operation = Task {
                await work()
                task.setTaskCompleted(success: true)
            }
            task.expirationHandler = {
                operation.cancel()
                task.setTaskCompleted(success: false)
            }
        }
    }

    /// Requests the next run no earlier than the coming 5 AM local. Call at launch
    /// and again from the launch handler so the chain never breaks.
    static func schedule(now: Date = Date()) {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = nextFireDate(after: now)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // Simulators and unentitled builds throw here; that is expected and the
            // foreground catch-up covers it.
            logger.debug("bg submit failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// The next 5:00 AM strictly after `now`, in the device's timezone.
    static func nextFireDate(after now: Date) -> Date {
        let calendar = Calendar(identifier: .gregorian)
        guard let todayFive = calendar.date(bySettingHour: 5, minute: 0, second: 0, of: now) else {
            return now.addingTimeInterval(3600)
        }
        if todayFive > now { return todayFive }
        return calendar.date(byAdding: .day, value: 1, to: todayFive) ?? now.addingTimeInterval(3600)
    }
}
