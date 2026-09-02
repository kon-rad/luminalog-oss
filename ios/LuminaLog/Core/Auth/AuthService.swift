import Foundation

/// Errors common to authentication implementations.
enum AuthServiceError: LocalizedError {
    case notSignedIn
    case notImplemented(String)
    /// The user dismissed the provider's sign-in sheet. Not surfaced as an error.
    case cancelled
    /// The provider returned a credential we could not verify.
    case invalidCredential
    /// No window/view controller was available to present the sign-in UI.
    case missingPresenter
    /// The server rejected the SIWE signature or nonce.
    case walletVerificationFailed

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            return "You are not signed in."
        case .notImplemented(let what):
            return "\(what) is not wired up yet."
        case .cancelled:
            return "Sign-in was cancelled."
        case .invalidCredential:
            return "We couldn't verify that sign-in. Please try again."
        case .missingPresenter:
            return "Couldn't open the sign-in screen. Please try again."
        case .walletVerificationFailed:
            return "We couldn't verify that wallet. Please try again."
        }
    }
}

/// Display info for the signed-in user as reported by the auth provider.
/// Read after sign-in to seed the `users/{uid}` document.
struct AuthUserInfo: Equatable, Sendable {
    var displayName: String?
    var email: String?
    var photoURL: URL?

    init(displayName: String? = nil, email: String? = nil, photoURL: URL? = nil) {
        self.displayName = displayName
        self.email = email
        self.photoURL = photoURL
    }
}

/// Authentication session — Firebase Auth in production, an in-memory mock in demo mode.
@MainActor
protocol AuthService: AnyObject {

    /// The signed-in user's uid, or nil when signed out.
    var currentUserId: String? { get }

    /// Provider-reported display info for the signed-in user; nil when signed out.
    var currentUserInfo: AuthUserInfo? { get }

    /// Emits the current uid immediately, then on every auth state change.
    func authStateStream() -> AsyncStream<String?>

    /// Sign in with Apple — runs the interactive ASAuthorization handshake.
    func signInWithApple() async throws

    /// Sign in with Google — runs the interactive GoogleSignIn handshake.
    func signInWithGoogle() async throws

    /// Sign in (or wallet-first sign up) with a connected Ethereum wallet via
    /// SIWE. Mints a new uid only if this address has never linked before
    /// (server-side, spec §5.1): this call never changes an existing uid.
    func signInWithWallet() async throws

    /// Link a wallet to the ALREADY signed-in account. Returns the linked
    /// address. Throws if the address is already linked to a different account.
    func linkWallet() async throws -> String

    func signOut() throws

    /// Delete the account. Full server-side cleanup (Firestore, Chroma, S3,
    /// RevenueCat) goes through the proxy `/v1/account/delete` route in a later task.
    func deleteAccount() async throws
}
