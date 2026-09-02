import Foundation

/// Talks to the three stage-1 server SIWE routes (spec section 5.1, already merged
/// in `server/src/routes/auth.ts`). `/nonce` and `/verify` are UNAUTHENTICATED
/// by design (there is no signed-in user yet on the wallet-first path), so
/// they use a plain `URLSession` rather than `ProxyAPIClient` (which always
/// attaches a Firebase ID token). `/link` requires an existing session, so it
/// reuses `ProxyAPIClient`.
protocol SIWEAuthClient {
    /// `GET /v1/auth/siwe/nonce`.
    func fetchNonce() async throws -> String
    /// `POST /v1/auth/siwe/verify`. Returns a Firebase custom token to sign in
    /// with (`Auth.auth().signIn(withCustomToken:)`), for both the existing-
    /// account-by-address case and the wallet-first-signup case.
    func verify(message: String, signature: String) async throws -> String
    /// `POST /v1/auth/siwe/link`. Attaches the wallet to the CALLER's already
    /// signed-in account. Returns the linked address.
    func link(message: String, signature: String) async throws -> String
}

enum SIWEAuthClientError: LocalizedError {
    case httpError(statusCode: Int, body: String)
    case malformedResponse

    var errorDescription: String? {
        switch self {
        case .httpError(let statusCode, _): return "Sign-in failed (\(statusCode))."
        case .malformedResponse: return "Sign-in returned an unexpected response."
        }
    }
}

final class LiveSIWEAuthClient: SIWEAuthClient {

    private let baseURL: URL
    private let session: URLSession
    private let authenticatedClient: ProxyAPIClient

    init(baseURL: URL, session: URLSession = .shared, authenticatedClient: ProxyAPIClient) {
        self.baseURL = baseURL
        self.session = session
        self.authenticatedClient = authenticatedClient
    }

    func fetchNonce() async throws -> String {
        struct NonceResponse: Decodable { let nonce: String }
        let response: NonceResponse = try await getUnauthenticated(path: "/v1/auth/siwe/nonce")
        return response.nonce
    }

    func verify(message: String, signature: String) async throws -> String {
        struct VerifyBody: Encodable { let message: String; let signature: String }
        struct VerifyResponse: Decodable { let firebaseCustomToken: String }
        let response: VerifyResponse = try await postUnauthenticated(
            path: "/v1/auth/siwe/verify",
            body: VerifyBody(message: message, signature: signature)
        )
        return response.firebaseCustomToken
    }

    func link(message: String, signature: String) async throws -> String {
        struct LinkBody: Encodable { let message: String; let signature: String }
        struct LinkResponse: Decodable { let walletAddress: String }
        let response: LinkResponse = try await authenticatedClient.post(
            path: "/v1/auth/siwe/link",
            body: LinkBody(message: message, signature: signature)
        )
        return response.walletAddress
    }

    // MARK: - Unauthenticated helpers

    private func getUnauthenticated<T: Decodable>(path: String) async throws -> T {
        let url = baseURL.appendingPathComponent(String(path.dropFirst()))
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        return try await send(request)
    }

    private func postUnauthenticated<T: Decodable>(path: String, body: some Encodable) async throws -> T {
        let url = baseURL.appendingPathComponent(String(path.dropFirst()))
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await send(request)
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw SIWEAuthClientError.httpError(statusCode: statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
        guard let decoded = try? JSONDecoder().decode(T.self, from: data) else {
            throw SIWEAuthClientError.malformedResponse
        }
        return decoded
    }
}
