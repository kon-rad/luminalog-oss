import UIKit
import UserNotifications

/// Captures the background URLSession completion handler iOS hands us when it
/// relaunches the app to deliver finished background uploads. The app wires
/// `onBackgroundURLSessionEvents` to forward the handler to BackgroundUploadTransport.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var onBackgroundURLSessionEvents: ((@escaping () -> Void) -> Void)?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Set before launch finishes so a tap that launched the app is delivered.
        UNUserNotificationCenter.current().delegate = self
        // BGTaskScheduler requires every handler to be registered before launch
        // completes, which is earlier than any view exists. The coordinator lives in
        // the view layer (it needs AppServices), so the handler just posts a
        // notification that RootView observes and answers by running the cycle.
        EncouragementRefreshTask.register {
            await MainActor.run {
                NotificationCenter.default.post(name: .encouragementRefreshRequested, object: nil)
            }
            // Give the observer room to finish the cycle before the task reports
            // completion. Well inside the budget iOS grants an app-refresh task.
            try? await Task.sleep(for: EncouragementRefreshTask.handlerBudget)
        }
        EncouragementRefreshTask.schedule()
        return true
    }

    func application(_ application: UIApplication,
                     handleEventsForBackgroundURLSession identifier: String,
                     completionHandler: @escaping () -> Void) {
        onBackgroundURLSessionEvents?(completionHandler)
    }

    /// A tapped Mirror Echo opens its detail; other notifications just open the app.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let id = MirrorRouter.mirrorId(from: response.notification.request.content.userInfo)
        Task { @MainActor in
            MirrorRouter.shared.open(mirrorId: id)
            completionHandler()
        }
    }

    /// Unchanged behavior: no banners while the app is in the foreground.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([])
    }
}

extension Notification.Name {
    /// Posted when the background refresh task fires. `RootView` observes it and
    /// runs `EncouragementCoordinator.runCycle`, which owns the app's services.
    static let encouragementRefreshRequested = Notification.Name("ll-encouragement-refresh-requested")
}
