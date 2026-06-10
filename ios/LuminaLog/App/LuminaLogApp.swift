import SwiftUI
import OSLog
import FirebaseCore

@main
struct LuminaLogApp: App {

    init() {
        let logger = Logger(subsystem: "com.luminalog.app", category: "startup")
        if AppConfig.isFirebaseConfigured {
            FirebaseApp.configure()
            logger.info("Firebase configured.")
        } else {
            logger.info("GoogleService-Info.plist not found — running in demo mode.")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .tint(.accentWarm)
        }
    }
}
