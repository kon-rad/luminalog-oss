import SwiftUI
import OSLog
import CryptoKit
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
    /// Set when the one-time ZK migration prompt (phase 1d, `DevFlags.zkMigration`
    /// — OFF by default) needs to run for the signed-in user; presented as a
    /// full-screen cover over `RootView`. Temporary — deleted after the cutover.
    @State private var migrationPresentation: ZKMigrationPresentation?

    /// Shared onboarding store: the gate reads/writes the flag and the buffered
    /// draft; SessionStore reads the same draft to merge it after sign-in.
    private let onboardingStore = OnboardingStore()

    init() {
        let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "startup")

        // Zero-knowledge is the ONLY architecture: the client always decrypts locally
        // and the server holds no key (the legacy server-decrypt path was deleted at the
        // Phase-3 cutover — see ADR-0073). So the Model-1 (ZK) path is the default for
        // EVERY build; the non-ZK path no longer exists on the server.
        UserDefaults.standard.register(defaults: [DevFlags.aiModel1Key: true])

        #if DEBUG
        // Dev mode ON in DEBUG so the SettingsView developer tools (onboarding replay,
        // daily-report generation, constellation rebuild) are available for testing.
        // Release builds never reach this branch, so production is unaffected.
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
            onboarding: onboarding,
            consentService: services.consentService
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
                        // AI-data-sharing consent gate (App Store 5.1.1/5.1.2):
                        // blocks the signed-in app until consent is recorded AND
                        // synced to the server. New users pass instantly (consent
                        // was recorded in onboarding); already-onboarded users see
                        // `AIConsentView` once.
                        //
                        // Hard paywall: Pro is required to use the app. The gate
                        // renders RootView only once the entitlement resolves to pro.
                        // Re-key the whole shell per uid: repository streams capture
                        // the user at creation, so all tab content must be rebuilt
                        // when the signed-in user changes.
                        ConsentGate(store: services.consentStore, service: services.consentService) {
                            PaywallGate(
                                subscriptions: services.subscriptions,
                                onSignOut: { try? services.auth.signOut() }
                            ) {
                                RootView()
                                    .id(uid)
                            }
                        }
                        .id(uid)
                        // Once the signed-in user is established, resume any
                        // durable upload-journal records (finalize completed
                        // ones, restart the rest). Idempotent/guarded; runs once
                        // per signed-in user via the stable id.
                        .task(id: uid) {
                            await services.entryProcessor.resumePendingJobs()
                        }
                        // Keep today's daily-goal progress + streak reconciled
                        // from the entries created today (self-healing across
                        // transcript retries, edits, and deletes). Runs for the
                        // whole signed-in session; torn down when uid changes.
                        .task(id: uid) {
                            await services.dailyGoalReconciler.run()
                        }
                        // One-time ZK migration check (phase 1d). No-ops unless
                        // `DevFlags.zkMigration` is ON; see `checkZKMigration`.
                        .task(id: uid) {
                            await checkZKMigration(uid: uid)
                        }
                        .fullScreenCover(item: $migrationPresentation) { presentation in
                            if let migrator = services.keyMigrator {
                                ZKMigrationView(
                                    userId: presentation.userId,
                                    dek: presentation.dek,
                                    migrator: migrator,
                                    onDone: { migrationPresentation = nil }
                                )
                            }
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

    // MARK: - ZK migration (phase 1d, temporary — deleted after cutover)

    /// Decides whether to present `ZKMigrationView` for the signed-in user and,
    /// if so, arms `migrationPresentation`. A no-op whenever `DevFlags.zkMigration`
    /// is OFF (the default), so this changes nothing in production.
    @MainActor
    private func checkZKMigration(uid: String) async {
        guard DevFlags.zkMigration else { return }
        guard let dek = services.keys.currentDataKey else { return }
        guard let transport = services.keyMigrationTransport else { return }

        let hasServerWraps: Bool
        do {
            hasServerWraps = try await transport.fetchWraps() != nil
        } catch {
            // Unknown state (e.g. offline) — fail closed and don't prompt; the
            // check re-runs next launch/foreground via the `.task(id: uid)`.
            return
        }

        let locallyMarkedDone = ZKMigrationLocalMark.isDone(userId: uid)
        guard ZKMigrationGate.shouldPrompt(
            flagOn: DevFlags.zkMigration,
            userId: uid,
            hasServerWraps: hasServerWraps,
            locallyMarkedDone: locallyMarkedDone
        ) else { return }

        migrationPresentation = ZKMigrationPresentation(userId: uid, dek: dek)
    }
}

/// Identifies the signed-in user + their DEK for the `ZKMigrationView`
/// full-screen cover. Temporary — deleted with the rest of the phase-1d
/// migration path after the one-time cutover.
private struct ZKMigrationPresentation: Identifiable {
    var id: String { userId }
    let userId: String
    let dek: SymmetricKey
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
