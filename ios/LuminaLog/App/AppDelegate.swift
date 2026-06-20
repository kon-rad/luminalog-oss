import UIKit

/// Captures the background URLSession completion handler iOS hands us when it
/// relaunches the app to deliver finished background uploads. The app wires
/// `onBackgroundURLSessionEvents` to forward the handler to BackgroundUploadTransport.
final class AppDelegate: NSObject, UIApplicationDelegate {
    var onBackgroundURLSessionEvents: ((@escaping () -> Void) -> Void)?

    func application(_ application: UIApplication,
                     handleEventsForBackgroundURLSession identifier: String,
                     completionHandler: @escaping () -> Void) {
        onBackgroundURLSessionEvents?(completionHandler)
    }
}
