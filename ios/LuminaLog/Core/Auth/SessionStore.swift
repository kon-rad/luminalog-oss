import Foundation
import OSLog

/// Where the app is in the auth lifecycle.
enum SessionState: Equatable {
    case loading
    case signedOut
    case signedIn(userId: String)
}

/// Owns the auth lifecycle: consumes the auth-state stream, routes between
/// signed-out and signed-in, ensures the `users/{uid}` document exists,
/// mirrors the live profile, and keeps the subscription identity in sync.
@MainActor
final class SessionStore: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "session")

    @Published private(set) var state: SessionState = .loading
    @Published private(set) var profile: UserProfile?
    /// True for the duration of the first sign-in session (Firestore document
    /// was just created). Resets to false on sign-out.
    @Published private(set) var isNewUser: Bool = false

    private let auth: AuthService
    private let keys: UserKeyStore
    private let profiles: ProfileRepository
    private let subscriptions: SubscriptionService
    private let onboarding: OnboardingStore

    private var authTask: Task<Void, Never>?
    private var profileTask: Task<Void, Never>?

    init(
        auth: AuthService,
        keys: UserKeyStore,
        profiles: ProfileRepository,
        subscriptions: SubscriptionService,
        onboarding: OnboardingStore
    ) {
        self.auth = auth
        self.keys = keys
        self.profiles = profiles
        self.subscriptions = subscriptions
        self.onboarding = onboarding

        authTask = Task { [weak self] in
            guard let stream = self?.auth.authStateStream() else { return }
            for await uid in stream {
                guard let self, !Task.isCancelled else { return }
                await self.handleAuthChange(uid)
            }
        }
    }

    deinit {
        authTask?.cancel()
        profileTask?.cancel()
    }

    // MARK: - Auth transitions

    private func handleAuthChange(_ uid: String?) async {
        // Ignore duplicate emissions (e.g. token refreshes re-yield the uid).
        switch (state, uid) {
        case (.signedIn(let current), .some(let next)) where current == next:
            return
        case (.signedOut, nil):
            return
        default:
            break
        }

        // Capture the previously signed-in user so we can clear their key.
        let previousUid: String?
        if case .signedIn(let u) = state { previousUid = u } else { previousUid = nil }

        // Profile streams capture the user at creation — always tear the
        // current one down and re-create it for the new user.
        profileTask?.cancel()
        profileTask = nil

        if let uid {
            // Load the encryption key BEFORE any read/write: ensureUserDocument
            // seeds an encrypted profile and the profile stream decrypts. A
            // failure here is logged, not fatal — repositories fail closed
            // (reads yield empty, writes throw) until the key is available.
            do {
                try await keys.loadCipher(userId: uid)
            } catch {
                Self.logger.error("loadCipher failed: \(error.localizedDescription, privacy: .public)")
            }
            state = .signedIn(userId: uid)
            let createdNewUser = await ensureUserDocument()
            isNewUser = createdNewUser
            await mergeOnboardingDraftIfPresent(overwriteExisting: createdNewUser)
            startProfileStream()
            await subscriptions.setUser(uid)
        } else {
            if let previousUid { keys.signOut(userId: previousUid) }
            // Decrypted plaintext must not outlive the session.
            Task.detached { await MediaContentCache().purge() }
            state = .signedOut
            isNewUser = false
            profile = nil
            await subscriptions.setUser(nil)
        }
    }

    /// Creates `users/{uid}` on first sign-in. Returns `true` if it created the
    /// document. Failure is logged, not fatal: routing into the app must not be
    /// blocked by a transient write error (treated as "not newly created").
    private func ensureUserDocument() async -> Bool {
        let info = auth.currentUserInfo
        do {
            return try await profiles.ensureUserDocument(
                displayName: info?.displayName,
                email: info?.email,
                photoURL: info?.photoURL
            )
        } catch {
            Self.logger.error("ensureUserDocument failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    /// Merges buffered onboarding answers into the profile after the user doc is
    /// ensured, then clears the local draft. For a brand-new account the answers
    /// win over provider-seeded defaults (`overwriteExisting`); for a returning
    /// user only blank fields are filled. Best-effort: failures are logged, never
    /// block routing into the app.
    private func mergeOnboardingDraftIfPresent(overwriteExisting: Bool) async {
        let draft = onboarding.loadDraft()
        guard !draft.isEmpty else { return }
        do {
            try await profiles.mergeOnboardingDraft(draft, overwriteExisting: overwriteExisting)
            onboarding.clearDraft()
        } catch {
            Self.logger.error("onboarding merge failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Call after the user completes onboarding while already signed in, so the
    /// draft answers are merged into their Firestore profile immediately.
    func mergeOnboardingDraft() async {
        await mergeOnboardingDraftIfPresent(overwriteExisting: isNewUser)
    }

    private func startProfileStream() {
        profileTask = Task { [weak self] in
            guard let stream = self?.profiles.profile() else { return }
            for await profile in stream {
                guard let self, !Task.isCancelled else { return }
                self.profile = profile
            }
        }
    }
}
