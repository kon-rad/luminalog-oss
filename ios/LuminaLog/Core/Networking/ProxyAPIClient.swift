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

/// Thin JSON/SSE client for the LuminaLog proxy API (spec §4).
/// Attaches `Authorization: Bearer <Firebase ID token>` to every call and
/// retries exactly once with a force-refreshed token on HTTP 401.
final class ProxyAPIClient {

    private let baseURL: URL
    private let tokenProvider: TokenProvider
    private let session: URLSession

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

    init(baseURL: URL, tokenProvider: TokenProvider, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.session = session
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

    private func postData(path: String, body: some Encodable) async throws -> Data {
        let request = try await makeRequest(path: path, body: body)
        var (data, response) = try await session.data(for: request)

        // On 401, retry exactly once with a force-refreshed token.
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            let retryRequest = try await makeRequest(path: path, body: body, forceRefresh: true)
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
        forceRefresh: Bool = false
    ) async throws -> URLRequest {
        // Append to the base URL's path so a base URL with a path prefix
        // (e.g. https://api.example.com/luminalog) is preserved. Route
        // constants use a leading "/" which appendingPathComponent handles.
        let component = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appendingPathComponent(component)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token = try await tokenProvider.idToken(forceRefresh: forceRefresh)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(body)
        return request
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
