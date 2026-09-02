import UIKit

/// Captures the background URLSession completion handler iOS hands us when it
/// relaunches the app to deliver finished background uploads. The app wires
/// `onBackgroundURLSessionEvents` to forward the handler to BackgroundUploadTransport.
final class AppDelegate: NSObject, UIApplicationDelegate {
    var onBackgroundURLSessionEvents: ((@escaping () -> Void) -> Void)?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
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
}

extension Notification.Name {
    /// Posted when the background refresh task fires. `RootView` observes it and
    /// runs `EncouragementCoordinator.runCycle`, which owns the app's services.
    static let encouragementRefreshRequested = Notification.Name("ll-encouragement-refresh-requested")
}
