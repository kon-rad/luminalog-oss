import SwiftUI
import OSLog
import FirebaseCore
import GoogleSignIn

@main
struct LuminaLogApp: App {

    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var services: AppServices
    @StateObject private var session: SessionStore

    @AppStorage(ThemeMode.storageKey) private var themeMode: String = ThemeMode.system.rawValue
    /// Mirrors `OnboardingStore`'s completion flag so the gate re-renders the
    /// moment onboarding finishes (it writes the same UserDefaults key).
    @AppStorage(OnboardingStore.completedKey) private var onboardingCompleted: Bool = false
    @Environment(\.scenePhase) private var scenePhase
    @State private var foregroundStart: Date?

    /// Shared onboarding store: the gate reads/writes the flag and the buffered
    /// draft; SessionStore reads the same draft to merge it after sign-in.
    private let onboardingStore = OnboardingStore()

    init() {
        let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "startup")

        #if DEBUG
        // Debug builds default to dev mode on (paywall/credit gates off, dev
        // tools like the onboarding replay visible). Registration only sets the
        // value when the user hasn't explicitly overridden the key, so toggling
        // it off still sticks.
        UserDefaults.standard.register(defaults: [DevFlags.devModeKey: true])
        #endif

        // Upgrade the legacy `ll-force-dark` boolean to the three-way theme setting
        // before any view reads it; runs at most once.
        ThemeMode.migrateLegacyIfNeeded()

        FirebaseApp.configure()
        logger.info("Firebase configured.")

        // Built after Firebase is configured; SessionStore shares the same
        // service instances so auth state, profile, and subscription identity
        // stay consistent across the app.
        let services = AppServices.live()
        let onboarding = onboardingStore
        _services = StateObject(wrappedValue: services)
        _session = StateObject(wrappedValue: SessionStore(
            auth: services.auth,
            keys: services.keys,
            profiles: services.profiles,
            subscriptions: services.subscriptions,
            onboarding: onboarding
        ))
    }

    var body: some Scene {
        WindowGroup {
            Group {
                switch session.state {
                case .loading:
                    SplashView()
                case .signedOut:
                    // New users walk onboarding first; once completed (or for a
                    // returning user who has finished it) we route to sign-in.
                    if onboardingCompleted {
                        SignInView()
                    } else {
                        OnboardingView(
                            store: onboardingStore,
                            speech: services.speech,
                            onComplete: { onboardingCompleted = true }
                        )
                    }
                case .signedIn(let uid):
                    if !onboardingCompleted {
                        // Signed in but onboarding not yet done (new user who
                        // signed in before completing the pre-auth flow, or
                        // reinstall). Merge the draft into their profile when
                        // they finish.
                        OnboardingView(
                            store: onboardingStore,
                            speech: services.speech,
                            onComplete: {
                                onboardingCompleted = true
                                Task { await session.mergeOnboardingDraft() }
                            }
                        )
                    } else {
                        // Hard paywall: Pro is required to use the app. The gate
                        // renders RootView only once the entitlement resolves to pro.
                        // Re-key the whole shell per uid: repository streams capture
                        // the user at creation, so all tab content must be rebuilt
                        // when the signed-in user changes.
                        PaywallGate(
                            subscriptions: services.subscriptions,
                            onSignOut: { try? services.auth.signOut() }
                        ) {
                            RootView()
                                .id(uid)
                        }
                        .id(uid)
                        // Once the signed-in user is established, resume any
                        // durable upload-journal records (finalize completed
                        // ones, restart the rest). Idempotent/guarded; runs once
                        // per signed-in user via the stable id.
                        .task(id: uid) {
                            await services.entryProcessor.resumePendingJobs()
                        }
                    }
                }
            }
            .onAppear {
                // Forward the system's background-URLSession completion handler
                // (delivered to AppDelegate when iOS relaunches us for finished
                // uploads) to the live transport so it can call it once all
                // delegate events are drained. Set here (not in init) because the
                // delegate adaptor isn't accessible until the scene is built.
                appDelegate.onBackgroundURLSessionEvents = { [services] handler in
                    services.uploadTransport?.backgroundCompletionHandler = handler
                }
            }
            .environmentObject(services)
            .environmentObject(session)
            .tint(.accentWarm)
            .preferredColorScheme((ThemeMode(rawValue: themeMode) ?? .system).colorScheme)
            .onOpenURL { url in
                _ = GIDSignIn.sharedInstance.handle(url)
            }
            .onChange(of: scenePhase) { _, newPhase in
                switch newPhase {
                case .active:
                    foregroundStart = Date()
                case .background:
                    guard let start = foregroundStart else { return }
                    foregroundStart = nil
                    let minutes = max(1, Int(Date().timeIntervalSince(start) / 60))
                    Task { try? await services.profiles.recordTimeSpent(minutes: minutes) }
                default:
                    break
                }
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
