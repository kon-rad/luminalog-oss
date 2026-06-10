import SwiftUI
import OSLog
import FirebaseCore
import GoogleSignIn

@main
struct LuminaLogApp: App {

    @StateObject private var services: AppServices
    @StateObject private var session: SessionStore

    init() {
        let logger = Logger(subsystem: "com.luminalog.app", category: "startup")
        if AppConfig.isFirebaseConfigured {
            FirebaseApp.configure()
            logger.info("Firebase configured.")
        } else {
            logger.info("GoogleService-Info.plist not found — running in demo mode.")
        }

        // Built after Firebase is configured; SessionStore shares the same
        // service instances so auth state, profile, and subscription identity
        // stay consistent across the app.
        let services = AppServices.live()
        _services = StateObject(wrappedValue: services)
        _session = StateObject(wrappedValue: SessionStore(
            auth: services.auth,
            profiles: services.profiles,
            subscriptions: services.subscriptions
        ))
    }

    var body: some Scene {
        WindowGroup {
            Group {
                switch session.state {
                case .loading:
                    SplashView()
                case .signedOut:
                    SignInView(signInDemo: {
                        // Demo sign-in lives only on the mock (see MockAuthService);
                        // the protocol stays clean for the real providers.
                        await (services.auth as? MockAuthService)?.signInDemo()
                    })
                case .signedIn(let uid):
                    // Re-key the whole shell per uid: repository streams capture
                    // the user at creation, so all tab content must be rebuilt
                    // when the signed-in user changes.
                    RootView()
                        .id(uid)
                }
            }
            .environmentObject(services)
            .environmentObject(session)
            .tint(.accentWarm)
            .onOpenURL { url in
                guard AppConfig.isFirebaseConfigured else { return }
                _ = GIDSignIn.sharedInstance.handle(url)
            }
        }
    }
}

/// Minimal splash shown while the first auth-state emission is in flight.
private struct SplashView: View {
    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()
            Text("LuminaLog")
                .font(.journalTitle)
                .foregroundStyle(Color.textPrimary)
        }
    }
}
