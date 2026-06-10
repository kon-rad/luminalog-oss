import Foundation

/// Errors common to authentication implementations.
enum AuthServiceError: LocalizedError {
    case notSignedIn
    case notImplemented(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            return "You are not signed in."
        case .notImplemented(let what):
            return "\(what) is not wired up yet."
        }
    }
}

/// Authentication session — Firebase Auth in production, an in-memory mock in demo mode.
protocol AuthService: AnyObject {

    /// The signed-in user's uid, or nil when signed out.
    var currentUserId: String? { get }

    /// Emits the current uid immediately, then on every auth state change.
    func authStateStream() -> AsyncStream<String?>

    /// Sign in with Apple. The interactive handshake is wired in the auth UI task.
    func signInWithApple() async throws

    /// Sign in with Google. The interactive handshake is wired in the auth UI task.
    func signInWithGoogle() async throws

    func signOut() throws

    /// Delete the account. Full server-side cleanup (Firestore, Chroma, S3,
    /// RevenueCat) goes through the proxy `/v1/account/delete` route in a later task.
    func deleteAccount() async throws
}
