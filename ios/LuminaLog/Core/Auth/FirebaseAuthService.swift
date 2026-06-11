import Foundation
import UIKit
import AuthenticationServices
import CryptoKit
import FirebaseAuth
import FirebaseCore
import GoogleSignIn

/// `AuthService` backed by Firebase Auth, with interactive Sign in with
/// Apple (ASAuthorizationController) and Google Sign-In handshakes.
@MainActor
final class FirebaseAuthService: AuthService {

    var currentUserId: String? {
        Auth.auth().currentUser?.uid
    }

    var currentUserInfo: AuthUserInfo? {
        guard let user = Auth.auth().currentUser else { return nil }
        return AuthUserInfo(
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL
        )
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

    // MARK: - Sign in with Apple

    func signInWithApple() async throws {
        // Raw nonce goes to Firebase; its SHA256 goes into the Apple request,
        // so Firebase can verify the identity token was minted for us.
        let rawNonce = Self.randomNonceString()

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256(rawNonce)

        guard let anchor = Self.keyWindow() else {
            throw AuthServiceError.missingPresenter
        }
        // The local strong reference keeps the coordinator alive across the
        // await (ASAuthorizationController does not retain its delegate).
        let coordinator = AppleSignInCoordinator(anchor: anchor)

        let authorization: ASAuthorization
        do {
            authorization = try await coordinator.performRequest(request)
        } catch let error as ASAuthorizationError where error.code == .canceled {
            throw AuthServiceError.cancelled
        }

        guard
            let appleCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = appleCredential.identityToken,
            let idToken = String(data: tokenData, encoding: .utf8)
        else {
            throw AuthServiceError.invalidCredential
        }

        // fullName is only delivered on the very first authorization; passing
        // it here lets Firebase set the user's display name on that sign-in.
        let credential = OAuthProvider.appleCredential(
            withIDToken: idToken,
            rawNonce: rawNonce,
            fullName: appleCredential.fullName
        )
        try await Auth.auth().signIn(with: credential)
    }

    // MARK: - Google Sign-In

    func signInWithGoogle() async throws {
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            throw AuthServiceError.notImplemented("Google Sign-In (no Firebase client ID)")
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)

        guard let presenter = Self.keyWindow()?.rootViewController else {
            throw AuthServiceError.missingPresenter
        }

        let result: GIDSignInResult
        do {
            result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        } catch let error as NSError where error.domain == kGIDSignInErrorDomain
            && error.code == GIDSignInError.canceled.rawValue {
            throw AuthServiceError.cancelled
        }

        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthServiceError.invalidCredential
        }
        let credential = GoogleAuthProvider.credential(
            withIDToken: idToken,
            accessToken: result.user.accessToken.tokenString
        )
        try await Auth.auth().signIn(with: credential)
    }

    // MARK: - Sign out / delete

    func signOut() throws {
        GIDSignIn.sharedInstance.signOut()
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

    // MARK: - Helpers

    static func keyWindow() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
    }

    /// Cryptographically secure random nonce. The 64-character set divides
    /// 256 evenly, so masking the random byte introduces no modulo bias.
    private static func randomNonceString(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-.")
        precondition(charset.count == 64)
        var bytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        precondition(status == errSecSuccess, "Unable to generate a secure nonce.")
        return String(bytes.map { charset[Int($0 & 0x3F)] })
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}

/// Bridges the delegate-based `ASAuthorizationController` flow into async/await.
/// Callbacks arrive on the main queue; the continuation is resumed exactly once.
final class AppleSignInCoordinator: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {

    private var continuation: CheckedContinuation<ASAuthorization, Error>?

    /// The window the provider sheet presents from, validated by the caller
    /// before the flow starts (no detached-anchor fallback).
    private let anchor: ASPresentationAnchor

    init(anchor: ASPresentationAnchor) {
        self.anchor = anchor
    }

    @MainActor
    func performRequest(_ request: ASAuthorizationAppleIDRequest) async throws -> ASAuthorization {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        continuation?.resume(returning: authorization)
        continuation = nil
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor
    }
}

/// `TokenProvider` that vends the signed-in Firebase user's ID token.
final class FirebaseTokenProvider: TokenProvider {

    func idToken(forceRefresh: Bool) async throws -> String {
        guard let user = Auth.auth().currentUser else {
            throw AuthServiceError.notSignedIn
        }
        return try await withCheckedThrowingContinuation { continuation in
            user.getIDTokenForcingRefresh(forceRefresh) { token, error in
                if let token {
                    continuation.resume(returning: token)
                } else {
                    continuation.resume(throwing: error ?? AuthServiceError.notSignedIn)
                }
            }
        }
    }
}
