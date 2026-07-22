import XCTest
@testable import LuminaLog

// MARK: - Test doubles

private final class RetryStubTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

/// Serves a scripted queue of outcomes — either an HTTP status+body or a
/// network-level `URLError` — one per request, so tests can assert exact
/// request counts across the transient-retry loop.
private final class RetryURLProtocol: URLProtocol {

    enum Step {
        case status(Int, Data)
        case failure(URLError)
    }

    nonisolated(unsafe) static var queue: [Step] = []
    nonisolated(unsafe) static var requestCount = 0

    static func reset(_ steps: [Step]) {
        queue = steps
        requestCount = 0
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requestCount += 1
        let step = Self.queue.isEmpty ? .status(200, Data("{}".utf8)) : Self.queue.removeFirst()
        switch step {
        case .status(let code, let body):
            let response = HTTPURLResponse(
                url: request.url!, statusCode: code, httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        case .failure(let error):
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private struct TextResponse: Decodable { let text: String }
private struct RawEmptyResponse: Decodable {}

// MARK: - Tests

/// Covers the transient-retry loop on the raw-bytes transcription path
/// (`postRaw` → `transcribeClip`). See the voice-transcription-reliability spec.
final class ProxyAPIClientTranscribeRetryTests: XCTestCase {

    /// Zero-delay retry policy so tests don't actually sleep.
    private func makeClient() -> ProxyAPIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RetryURLProtocol.self]
        let session = URLSession(configuration: config)
        return ProxyAPIClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: RetryStubTokenProvider(),
            session: session,
            transientRetry: TransientRetryPolicy(attempts: 3, backoff: { _ in 0 }, sleep: { _ in })
        )
    }

    func testRetriesOnTransient500ThenSucceeds() async throws {
        RetryURLProtocol.reset([
            .status(500, Data(#"{"error":"upstream"}"#.utf8)),
            .status(200, Data(#"{"text":"the transcript"}"#.utf8)),
        ])
        let client = makeClient()

        let out: TextResponse = try await client.postRaw(
            path: "/v1/ai/transcribe-clip", body: Data("bytes".utf8), contentType: "audio/m4a"
        )

        XCTAssertEqual(out.text, "the transcript")
        XCTAssertEqual(RetryURLProtocol.requestCount, 2)
    }

    func testRetriesOnTimeoutThenSucceeds() async throws {
        RetryURLProtocol.reset([
            .failure(URLError(.timedOut)),
            .status(200, Data(#"{"text":"recovered"}"#.utf8)),
        ])
        let client = makeClient()

        let out: TextResponse = try await client.postRaw(
            path: "/v1/ai/transcribe-clip", body: Data("bytes".utf8), contentType: "audio/m4a"
        )

        XCTAssertEqual(out.text, "recovered")
        XCTAssertEqual(RetryURLProtocol.requestCount, 2)
    }

    func testDoesNotRetryOn400() async {
        RetryURLProtocol.reset([
            .status(400, Data(#"{"error":"bad request"}"#.utf8)),
        ])
        let client = makeClient()

        do {
            let _: RawEmptyResponse = try await client.postRaw(
                path: "/v1/ai/transcribe-clip", body: Data("bytes".utf8), contentType: "audio/m4a"
            )
            XCTFail("expected httpError to propagate")
        } catch ProxyAPIError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 400)
        } catch {
            XCTFail("unexpected error: \(error)")
        }

        XCTAssertEqual(RetryURLProtocol.requestCount, 1)
    }

    func testGivesUpAfterMaxAttemptsAndSurfacesTheLastTransientStatus() async {
        RetryURLProtocol.reset([
            .status(503, Data("{}".utf8)),
            .status(503, Data("{}".utf8)),
            .status(503, Data("{}".utf8)),
        ])
        let client = makeClient()

        do {
            let _: RawEmptyResponse = try await client.postRaw(
                path: "/v1/ai/transcribe-clip", body: Data("bytes".utf8), contentType: "audio/m4a"
            )
            XCTFail("expected httpError to propagate after exhausting retries")
        } catch ProxyAPIError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 503)
        } catch {
            XCTFail("unexpected error: \(error)")
        }

        XCTAssertEqual(RetryURLProtocol.requestCount, 3)
    }
}
