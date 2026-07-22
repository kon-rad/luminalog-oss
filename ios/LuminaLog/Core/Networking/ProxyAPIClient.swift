import Foundation

/// Supplies the Firebase ID token attached to every proxy request.
/// A protocol so the client is testable without Firebase.
protocol TokenProvider: AnyObject {
    /// Returns a valid ID token, forcing a refresh against the auth backend
    /// when `forceRefresh` is true (used to recover from HTTP 401s).
    func idToken(forceRefresh: Bool) async throws -> String
}

/// Errors surfaced by `ProxyAPIClient`.
enum ProxyAPIError: LocalizedError {
    case invalidURL(String)
    case httpError(statusCode: Int, body: String)
    case emptyResponse

    var errorDescription: String? {
        switch self {
        case .invalidURL(let path):
            return "Invalid API path: \(path)"
        case .httpError(let statusCode, _):
            return "The server returned an error (\(statusCode))."
        case .emptyResponse:
            return "The server returned an empty response."
        }
    }
}

/// Bounded exponential-backoff retry for transient failures on the raw-bytes
/// (audio transcription) path. Injectable so tests run with zero delay.
struct TransientRetryPolicy {
    /// Total attempts including the first (so `3` = 1 try + 2 retries).
    var attempts: Int
    /// Backoff before the retry that FOLLOWS the given 1-based attempt, in nanoseconds.
    var backoff: (Int) -> UInt64
    /// Suspends for the given nanoseconds (real `Task.sleep` in production).
    var sleep: (UInt64) async -> Void

    static let `default` = TransientRetryPolicy(
        attempts: 3,
        backoff: { attempt in UInt64(250_000_000) << (attempt - 1) }, // 250ms, 500ms
        sleep: { ns in try? await Task.sleep(nanoseconds: ns) }
    )
}

/// Thin JSON/SSE client for the LuminaLog proxy API (spec §4).
/// Attaches `Authorization: Bearer <Firebase ID token>` to every call and
/// retries exactly once with a force-refreshed token on HTTP 401.
final class ProxyAPIClient {

    private let baseURL: URL
    private let tokenProvider: TokenProvider
    private let session: URLSession
    private let transientRetry: TransientRetryPolicy

    /// DRY client-side backstop for AI routes: when the server 403s with a
    /// consent error (Task 8 gates AI routes on server-recorded consent),
    /// re-sync consent locally then retry the request exactly once. Settable
    /// after init (rather than injected via `init`) to break the
    /// `ConsentService` <-> `ProxyAPIClient` construction cycle — `AppServices.live()`
    /// wires this in after both are built. `nil` means no recovery is attempted
    /// (e.g. in test/mock wiring), and the 403 surfaces as `ProxyAPIError.httpError` as before.
    var consentRecovery: (() async throws -> Void)?

    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    init(
        baseURL: URL,
        tokenProvider: TokenProvider,
        session: URLSession = .shared,
        transientRetry: TransientRetryPolicy = .default
    ) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.session = session
        self.transientRetry = transientRetry
    }

    // MARK: - Request / response

    /// POST a JSON body and decode a JSON response.
    func post<T: Decodable>(path: String, body: some Encodable) async throws -> T {
        let data = try await postData(path: path, body: body)
        return try decoder.decode(T.self, from: data)
    }

    /// POST a JSON body, ignoring the response payload.
    func post(path: String, body: some Encodable) async throws {
        _ = try await postData(path: path, body: body)
    }

    /// PUT a JSON body and decode a JSON response.
    func put<T: Decodable>(path: String, body: some Encodable) async throws -> T {
        let data = try await putData(path: path, body: body)
        return try decoder.decode(T.self, from: data)
    }

    /// PUT a JSON body, ignoring the response payload.
    func put(path: String, body: some Encodable) async throws {
        _ = try await putData(path: path, body: body)
    }

    /// DELETE a path (query string allowed), ignoring the response payload.
    /// Retries exactly once with a force-refreshed token on HTTP 401.
    func delete(path: String) async throws {
        let request = try await makeBodylessRequest(path: path, method: "DELETE")
        var (data, response) = try await session.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            let retry = try await makeBodylessRequest(path: path, method: "DELETE", forceRefresh: true)
            (data, response) = try await session.data(for: retry)
        }
        try Self.validate(response: response, data: data)
    }

    /// GET a path (query string allowed) and decode a JSON response.
    /// Retries exactly once with a force-refreshed token on HTTP 401.
    func get<T: Decodable>(path: String) async throws -> T {
        let request = try await makeBodylessRequest(path: path, method: "GET")
        var (data, response) = try await session.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            let retry = try await makeBodylessRequest(path: path, method: "GET", forceRefresh: true)
            (data, response) = try await session.data(for: retry)
        }
        try Self.validate(response: response, data: data)
        return try decoder.decode(T.self, from: data)
    }

    /// POST raw bytes with an explicit content type and decode a JSON response.
    /// Used for binary uploads (e.g. audio clips) that aren't JSON-encoded.
    func postRaw<T: Decodable>(path: String, body: Data, contentType: String) async throws -> T {
        let data = try await postRawData(path: path, body: body, contentType: contentType)
        return try decoder.decode(T.self, from: data)
    }

    private func postRawData(path: String, body: Data, contentType: String) async throws -> Data {
        // Transcription is a slow, network-heavy call that intermittently fails
        // transiently (mobile-network drops, upstream 429/5xx). Retry the whole
        // request with backoff so one blip doesn't strand a voice entry. The 401
        // token-refresh and 403 consent-resync sub-retries live inside a single
        // attempt and don't consume the transient budget.
        let attempts = max(1, transientRetry.attempts)
        for attempt in 1...attempts {
            let isLast = attempt == attempts
            do {
                let (data, response) = try await rawRequestWithAuthRecovery(
                    path: path, body: body, contentType: contentType
                )
                if !isLast, Self.isTransientStatus(response) {
                    // Drain nothing (buffered Data), back off, and retry.
                    await transientRetry.sleep(transientRetry.backoff(attempt))
                    continue
                }
                try Self.validate(response: response, data: data)
                return data
            } catch let error where !isLast && Self.isTransientError(error) {
                await transientRetry.sleep(transientRetry.backoff(attempt))
                continue
            }
        }
        // Unreachable: the final attempt either returns or throws above.
        throw ProxyAPIError.emptyResponse
    }

    /// One raw POST with the existing single-shot 401 (token refresh) and 403
    /// (consent re-sync) recovery. Returns the final `(data, response)` without
    /// validating — the transient-retry loop decides whether to retry or surface it.
    private func rawRequestWithAuthRecovery(
        path: String, body: Data, contentType: String
    ) async throws -> (Data, URLResponse) {
        let request = try await makeRawRequest(path: path, body: body, contentType: contentType)
        var (data, response) = try await session.data(for: request)

        // On 401, retry exactly once with a force-refreshed token.
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            let retry = try await makeRawRequest(
                path: path, body: body, contentType: contentType, forceRefresh: true
            )
            (data, response) = try await session.data(for: retry)
        }

        // On 403 with a consent error, re-sync consent and retry exactly once.
        if let recovery = consentRecovery, Self.isConsentDenied(response: response, data: data) {
            try await recovery()
            let retry = try await makeRawRequest(path: path, body: body, contentType: contentType)
            (data, response) = try await session.data(for: retry)
        }

        return (data, response)
    }

    private func makeRawRequest(
        path: String,
        body: Data,
        contentType: String,
        forceRefresh: Bool = false
    ) async throws -> URLRequest {
        let component = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appendingPathComponent(component)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        // Transcribing a whole recording can legitimately take longer than the 60s
        // URLRequest default; bound it generously so a slow-but-working request
        // isn't cut short into a spurious timeout.
        request.timeoutInterval = 120
        let token = try await tokenProvider.idToken(forceRefresh: forceRefresh)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = body
        return request
    }

    private func postData(path: String, body: some Encodable) async throws -> Data {
        let request = try await makeRequest(path: path, body: body)
        var (data, response) = try await session.data(for: request)

        // On 401, retry exactly once with a force-refreshed token.
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            let retryRequest = try await makeRequest(path: path, body: body, forceRefresh: true)
            (data, response) = try await session.data(for: retryRequest)
        }

        // On 403 with a consent error, re-sync consent and retry exactly once.
        if let recovery = consentRecovery, Self.isConsentDenied(response: response, data: data) {
            try await recovery()
            let retryRequest = try await makeRequest(path: path, body: body)
            (data, response) = try await session.data(for: retryRequest)
        }

        try Self.validate(response: response, data: data)
        return data
    }

    private func putData(path: String, body: some Encodable) async throws -> Data {
        let request = try await makeRequest(path: path, body: body, method: "PUT")
        var (data, response) = try await session.data(for: request)

        // On 401, retry exactly once with a force-refreshed token.
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            let retryRequest = try await makeRequest(
                path: path, body: body, method: "PUT", forceRefresh: true
            )
            (data, response) = try await session.data(for: retryRequest)
        }

        // On 403 with a consent error, re-sync consent and retry exactly once.
        if let recovery = consentRecovery, Self.isConsentDenied(response: response, data: data) {
            try await recovery()
            let retryRequest = try await makeRequest(path: path, body: body, method: "PUT")
            (data, response) = try await session.data(for: retryRequest)
        }

        try Self.validate(response: response, data: data)
        return data
    }

    // MARK: - SSE streaming

    /// POST a JSON body and stream the SSE response, yielding the payload of
    /// each `data:` line. A `[DONE]` sentinel terminates the stream.
    func streamEvents(path: String, body: some Encodable) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var request = try await self.makeRequest(path: path, body: body)
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")

                    var (bytes, response) = try await self.session.bytes(for: request)

                    // On 401, retry exactly once with a force-refreshed token.
                    if (response as? HTTPURLResponse)?.statusCode == 401 {
                        var retryRequest = try await self.makeRequest(
                            path: path, body: body, forceRefresh: true
                        )
                        retryRequest.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                        (bytes, response) = try await self.session.bytes(for: retryRequest)
                    }

                    // On 403 with a consent error, re-sync consent and retry exactly once.
                    // The SSE transport only exposes a byte stream (no buffered `Data`), so
                    // sniff the body for "consent" by draining and re-decoding the first
                    // chunk of lines rather than the raw response body used elsewhere.
                    if let recovery = self.consentRecovery,
                       (response as? HTTPURLResponse)?.statusCode == 403 {
                        var sniffed = ""
                        for try await line in bytes.lines {
                            sniffed += line
                            if sniffed.count > 4096 { break }
                        }
                        if sniffed.contains("consent") {
                            try await recovery()
                            var retryRequest = try await self.makeRequest(path: path, body: body)
                            retryRequest.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                            (bytes, response) = try await self.session.bytes(for: retryRequest)
                        }
                    }

                    if let http = response as? HTTPURLResponse,
                       !(200..<300).contains(http.statusCode) {
                        throw ProxyAPIError.httpError(statusCode: http.statusCode, body: "")
                    }

                    for try await line in bytes.lines {
                        try Task.checkCancellation()
                        guard line.hasPrefix("data:") else { continue }
                        let payload = line.dropFirst("data:".count)
                            .trimmingCharacters(in: .whitespaces)
                        if payload == "[DONE]" { break }
                        if !payload.isEmpty { continuation.yield(payload) }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - Helpers

    private func makeRequest(
        path: String,
        body: some Encodable,
        method: String = "POST",
        forceRefresh: Bool = false
    ) async throws -> URLRequest {
        // Append to the base URL's path so a base URL with a path prefix
        // (e.g. https://api.example.com/luminalog) is preserved. Route
        // constants use a leading "/" which appendingPathComponent handles.
        let component = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appendingPathComponent(component)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token = try await tokenProvider.idToken(forceRefresh: forceRefresh)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(body)
        return request
    }

    /// Builds a bodyless authenticated request (e.g. DELETE). Unlike
    /// `makeRequest`, the URL is built with `URL(string:relativeTo:)` so a
    /// `?query=` in `path` is preserved (`appendingPathComponent` would
    /// percent-encode the `?`).
    private func makeBodylessRequest(
        path: String,
        method: String,
        forceRefresh: Bool = false
    ) async throws -> URLRequest {
        let component = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard let url = URL(string: component, relativeTo: baseURL) else {
            throw ProxyAPIError.invalidURL(path)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        let token = try await tokenProvider.idToken(forceRefresh: forceRefresh)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }

    /// True when the response is a 403 whose body mentions "consent" — the
    /// shape the server (Task 8) uses to signal `requireAiConsent` failed.
    /// Shared by the buffered-`Data` request paths (`streamEvents` sniffs the
    /// byte stream directly since it has no buffered body to inspect).
    private static func isConsentDenied(response: URLResponse, data: Data) -> Bool {
        (response as? HTTPURLResponse)?.statusCode == 403
            && String(data: data, encoding: .utf8)?.contains("consent") == true
    }

    /// HTTP statuses that are "busy, try again" — safe to retry. 4xx (e.g. 400)
    /// is a request problem and must NOT be retried; 401/403 have their own
    /// dedicated single-shot recovery and are handled before we get here.
    private static let transientStatuses: Set<Int> = [429, 500, 502, 503, 504]

    private static func isTransientStatus(_ response: URLResponse) -> Bool {
        guard let code = (response as? HTTPURLResponse)?.statusCode else { return false }
        return transientStatuses.contains(code)
    }

    /// Network-level failures worth retrying (timeouts, dropped/unreachable
    /// connections) — as opposed to programming errors or cancellation.
    private static func isTransientError(_ error: Error) -> Bool {
        guard let urlError = error as? URLError else { return false }
        switch urlError.code {
        case .timedOut, .networkConnectionLost, .cannotConnectToHost,
             .cannotFindHost, .dnsLookupFailed, .notConnectedToInternet,
             .secureConnectionFailed:
            return true
        default:
            return false
        }
    }

    private static func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw ProxyAPIError.httpError(
                statusCode: http.statusCode,
                body: String(data: data, encoding: .utf8) ?? ""
            )
        }
    }
}
