import Foundation
import FirebaseAuth

/// `AuthService` backed by Firebase Auth.
///
/// The interactive Apple/Google sign-in handshakes are wired up in the auth
/// UI task; until then those methods throw `notImplemented`.
final class FirebaseAuthService: AuthService {

    var currentUserId: String? {
        Auth.auth().currentUser?.uid
    }

    func authStateStream() -> AsyncStream<String?> {
        AsyncStream { continuation in
            let handle = Auth.auth().addStateDidChangeListener { _, user in
                continuation.yield(user?.uid)
            }
            continuation.onTermination = { _ in
                Auth.auth().removeStateDidChangeListener(handle)
            }
        }
    }

    func signInWithApple() async throws {
        // TODO(Task 4): ASAuthorizationController handshake → Firebase credential.
        throw AuthServiceError.notImplemented("Sign in with Apple")
    }

    func signInWithGoogle() async throws {
        // TODO(Task 4): GoogleSignIn handshake → Firebase credential.
        throw AuthServiceError.notImplemented("Google Sign-In")
    }

    func signOut() throws {
        try Auth.auth().signOut()
    }

    func deleteAccount() async throws {
        // Full cleanup (Firestore docs, Chroma vectors, S3 prefix, RevenueCat)
        // moves to the proxy `/v1/account/delete` route in a later task.
        guard let user = Auth.auth().currentUser else {
            throw AuthServiceError.notSignedIn
        }
        try await user.delete()
    }
}

/// `TokenProvider` that vends the signed-in Firebase user's ID token.
final class FirebaseTokenProvider: TokenProvider {

    func idToken() async throws -> String {
        guard let user = Auth.auth().currentUser else {
            throw AuthServiceError.notSignedIn
        }
        return try await user.getIDToken()
    }
}
