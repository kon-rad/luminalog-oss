import Foundation

/// In-memory `AuthService` for demo mode — starts signed out so the sign-in
/// screen (and its "Explore in Demo Mode" path) is exercised.
@MainActor
final class MockAuthService: AuthService {

    private(set) var currentUserId: String?
    private var continuations: [UUID: AsyncStream<String?>.Continuation] = [:]

    init(signedIn: Bool = false) {
        currentUserId = signedIn ? MockData.userId : nil
    }

    var currentUserInfo: AuthUserInfo? {
        guard currentUserId != nil else { return nil }
        return AuthUserInfo(displayName: "Demo User", email: "demo@luminalog.app")
    }

    func authStateStream() -> AsyncStream<String?> {
        AsyncStream { continuation in
            let key = UUID()
            continuations[key] = continuation
            continuation.onTermination = { [weak self] _ in
                // onTermination runs off the main actor; hop back before
                // touching main-actor state.
                Task { @MainActor in
                    self?.continuations[key] = nil
                }
            }
            continuation.yield(currentUserId)
        }
    }

    func signInWithApple() async throws {
        try? await Task.sleep(nanoseconds: 400_000_000)
        setUser(MockData.userId)
    }

    func signInWithGoogle() async throws {
        try? await Task.sleep(nanoseconds: 400_000_000)
        setUser(MockData.userId)
    }

    /// Instant demo sign-in. Intentionally NOT part of `AuthService` — the
    /// sign-in screen reaches it via a closure injected by the routing layer.
    func signInDemo() async {
        setUser(MockData.userId)
    }

    func signOut() throws {
        setUser(nil)
    }

    func deleteAccount() async throws {
        setUser(nil)
    }

    private func setUser(_ uid: String?) {
        currentUserId = uid
        for continuation in continuations.values {
            continuation.yield(uid)
        }
    }
}
