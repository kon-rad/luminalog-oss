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

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "session")

    @Published private(set) var state: SessionState = .loading
    @Published private(set) var profile: UserProfile?

    private let auth: AuthService
    private let profiles: ProfileRepository
    private let subscriptions: SubscriptionService

    private var authTask: Task<Void, Never>?
    private var profileTask: Task<Void, Never>?

    init(auth: AuthService, profiles: ProfileRepository, subscriptions: SubscriptionService) {
        self.auth = auth
        self.profiles = profiles
        self.subscriptions = subscriptions

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

        // Profile streams capture the user at creation — always tear the
        // current one down and re-create it for the new user.
        profileTask?.cancel()
        profileTask = nil

        if let uid {
            state = .signedIn(userId: uid)
            await ensureUserDocument()
            startProfileStream()
            await subscriptions.setUser(uid)
        } else {
            state = .signedOut
            profile = nil
            await subscriptions.setUser(nil)
        }
    }

    /// Creates `users/{uid}` on first sign-in. Failure is logged, not fatal:
    /// routing into the app must not be blocked by a transient write error.
    private func ensureUserDocument() async {
        let info = auth.currentUserInfo
        do {
            try await profiles.ensureUserDocument(
                displayName: info?.displayName,
                email: info?.email,
                photoURL: info?.photoURL
            )
        } catch {
            Self.logger.error("ensureUserDocument failed: \(error.localizedDescription, privacy: .public)")
        }
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
