import Foundation

/// Errors surfaced by `HermesBridgeService`. Independent of `ProxyAPIError`:
/// this client talks to the owner-only `hermes-bridge` gateway, not the
/// Argo proxy API, and has no Firebase token to refresh on a 401.
enum HermesBridgeError: LocalizedError {
    case invalidBaseURL
    case httpError(statusCode: Int, body: String)
    case notPaired

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "That doesn't look like a valid server URL."
        case .httpError(let statusCode, _) where statusCode == 401:
            return "This device's pairing was revoked. Pair again."
        case .httpError(let statusCode, _):
            return "The gateway returned an error (\(statusCode))."
        case .notPaired:
            return "Not paired with a Hermes Bridge gateway yet."
        }
    }

    /// True for a 401, the one status the view model reacts to by clearing
    /// the stored pairing rather than just showing an error.
    var isUnauthorized: Bool {
        if case .httpError(let statusCode, _) = self, statusCode == 401 { return true }
        return false
    }
}

protocol HermesBridgeService {
    /// Redeems a pairing code minted on the gateway host (`npm run pair`).
    /// Returns the long-lived device token on success.
    func pair(baseURL: URL, code: String, deviceName: String) async throws -> String
    func recentTasks(baseURL: URL, token: String, limit: Int) async throws -> [HermesTaskSummary]
    func recentChanges(baseURL: URL, token: String, limit: Int) async throws -> [HermesCommitSummary]
    func readFile(baseURL: URL, token: String, path: String) async throws -> HermesFileResult
    func openStream(baseURL: URL, token: String) -> HermesStreamConnection
}

/// Thin JSON client for the `hermes-bridge` gateway. Deliberately does not
/// reuse `ProxyAPIClient` (that client's retry/consent-recovery machinery is
/// specific to Firebase-token auth against the Argo proxy API; this gateway
/// has its own single-device bearer token and no refresh flow at all).
final class URLSessionHermesBridgeService: HermesBridgeService {

    private let session: URLSession
    private let decoder: JSONDecoder = JSONDecoder()
    private let encoder: JSONEncoder = JSONEncoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    func pair(baseURL: URL, code: String, deviceName: String) async throws -> String {
        struct Body: Encodable { let code: String; let deviceName: String }
        struct Response: Decodable { let deviceId: String; let token: String }

        let request = try makeRequest(
            baseURL: baseURL, path: "/v1/pair/redeem", method: "POST",
            token: nil, body: Body(code: code, deviceName: deviceName)
        )
        let response: Response = try await send(request)
        return response.token
    }

    func recentTasks(baseURL: URL, token: String, limit: Int) async throws -> [HermesTaskSummary] {
        struct Response: Decodable { let tasks: [HermesTaskSummary] }
        let request = try makeRequest(
            baseURL: baseURL, path: "/v1/tasks/recent", method: "GET",
            token: token, query: [URLQueryItem(name: "limit", value: String(limit))]
        )
        let response: Response = try await send(request)
        return response.tasks
    }

    func recentChanges(baseURL: URL, token: String, limit: Int) async throws -> [HermesCommitSummary] {
        struct Response: Decodable { let commits: [HermesCommitSummary] }
        let request = try makeRequest(
            baseURL: baseURL, path: "/v1/changes/recent", method: "GET",
            token: token, query: [URLQueryItem(name: "limit", value: String(limit))]
        )
        let response: Response = try await send(request)
        return response.commits
    }

    func readFile(baseURL: URL, token: String, path: String) async throws -> HermesFileResult {
        let request = try makeRequest(
            baseURL: baseURL, path: "/v1/files", method: "GET",
            token: token, query: [URLQueryItem(name: "path", value: path)]
        )
        return try await send(request)
    }

    func openStream(baseURL: URL, token: String) -> HermesStreamConnection {
        HermesStreamConnection(session: session, baseURL: baseURL, token: token)
    }

    // MARK: - Request plumbing

    private func makeRequest<Body: Encodable>(
        baseURL: URL, path: String, method: String,
        token: String?, query: [URLQueryItem] = [], body: Body
    ) throws -> URLRequest {
        var request = try makeRequest(baseURL: baseURL, path: path, method: method, token: token, query: query)
        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }

    private func makeRequest(
        baseURL: URL, path: String, method: String,
        token: String?, query: [URLQueryItem] = []
    ) throws -> URLRequest {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw HermesBridgeError.invalidBaseURL
        }
        components.path = path
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw HermesBridgeError.invalidBaseURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return request
    }

    private func send<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, urlResponse) = try await session.data(for: request)
        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            throw HermesBridgeError.httpError(statusCode: -1, body: "")
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw HermesBridgeError.httpError(
                statusCode: httpResponse.statusCode,
                body: String(data: data, encoding: .utf8) ?? ""
            )
        }
        return try decoder.decode(Response.self, from: data)
    }
}

/// A live `/v1/hermes/stream` WebSocket connection. Consumers iterate
/// `events` and call `send(_:)` to steer the remote `run_hermes.sh` session.
final class HermesStreamConnection {

    private let task: URLSessionWebSocketTask
    private let encoder = JSONEncoder()

    init(session: URLSession, baseURL: URL, token: String) {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.scheme = baseURL.scheme == "https" ? "wss" : "ws"
        components?.path = "/v1/hermes/stream"
        var request = URLRequest(url: components?.url ?? baseURL)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        task = session.webSocketTask(with: request)
        task.resume()
    }

    /// Inbound stream/status/exit events. Finishes when the socket closes or
    /// a frame fails to decode as a known `HermesStreamEvent`.
    var events: AsyncThrowingStream<HermesStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = self.task
            let decoder = JSONDecoder()

            func receiveNext() {
                task.receive { result in
                    switch result {
                    case .failure(let error):
                        continuation.finish(throwing: error)
                    case .success(let message):
                        guard case .string(let text) = message, let data = text.data(using: .utf8) else {
                            receiveNext()
                            return
                        }
                        do {
                            let event = try decoder.decode(HermesStreamEvent.self, from: data)
                            continuation.yield(event)
                        } catch {
                            // Skip unrecognized frames rather than tearing down the stream.
                        }
                        receiveNext()
                    }
                }
            }
            receiveNext()
        }
    }

    func send(_ control: HermesStreamControl) async throws {
        let data = try encoder.encode(control)
        let text = String(data: data, encoding: .utf8) ?? ""
        try await task.send(.string(text))
    }

    func close() {
        task.cancel(with: .goingAway, reason: nil)
    }
}
