import XCTest
@testable import LuminaLog

// MARK: - Test doubles

/// Fixed-token provider so `ProxyAPIClient` can build authed requests offline.
private final class ConsentRecoveryStubTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

/// Serves a scripted queue of responses, one per request received, so tests
/// can assert exact request counts (e.g. "one initial call + one retry").
private final class QueuedURLProtocol: URLProtocol {

    struct Scripted {
        let statusCode: Int
        let body: Data
    }

    // Language mode 5.0: statics need no strict-concurrency isolation checks.
    nonisolated(unsafe) static var queue: [Scripted] = []
    nonisolated(unsafe) static var requestCount = 0

    static func reset(_ scripted: [Scripted]) {
        queue = scripted
        requestCount = 0
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requestCount += 1
        let next = Self.queue.isEmpty ? Scripted(statusCode: 200, body: Data("{}".utf8)) : Self.queue.removeFirst()
        let response = HTTPURLResponse(
            url: request.url!, statusCode: next.statusCode, httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: next.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private struct EmptyBody: Encodable {}

// MARK: - Tests

/// Covers the Task 7 client-side backstop: on HTTP 403 with a "consent" body,
/// `ProxyAPIClient` invokes `consentRecovery` and retries the request exactly
/// once before surfacing an error.
final class ProxyAPIClientConsentRecoveryTests: XCTestCase {

    private func makeClient() -> ProxyAPIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [QueuedURLProtocol.self]
        let session = URLSession(configuration: config)
        return ProxyAPIClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: ConsentRecoveryStubTokenProvider(),
            session: session
        )
    }

    // MARK: postData (exercised via `post(path:body:)`)

    func testConsent403TriggersRecoveryAndRetriesOnce() async throws {
        QueuedURLProtocol.reset([
            .init(statusCode: 403, body: Data(#"{"error":"consent required"}"#.utf8)),
            .init(statusCode: 200, body: Data("{}".utf8)),
        ])
        let client = makeClient()
        var recoveryCalls = 0
        client.consentRecovery = { recoveryCalls += 1 }

        try await client.post(path: "/v1/ai/chat", body: EmptyBody())

        XCTAssertEqual(recoveryCalls, 1)
        XCTAssertEqual(QueuedURLProtocol.requestCount, 2)
    }

    func testConsent403WithoutConsentBodyDoesNotRecoverOrRetry() async {
        QueuedURLProtocol.reset([
            .init(statusCode: 403, body: Data(#"{"error":"forbidden"}"#.utf8)),
        ])
        let client = makeClient()
        var recoveryCalls = 0
        client.consentRecovery = { recoveryCalls += 1 }

        do {
            try await client.post(path: "/v1/ai/chat", body: EmptyBody())
            XCTFail("expected httpError to propagate")
        } catch ProxyAPIError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 403)
        } catch {
            XCTFail("unexpected error: \(error)")
        }

        XCTAssertEqual(recoveryCalls, 0)
        XCTAssertEqual(QueuedURLProtocol.requestCount, 1)
    }

    func testConsent403WithNilRecoveryDoesNotRetry() async {
        QueuedURLProtocol.reset([
            .init(statusCode: 403, body: Data(#"{"error":"consent required"}"#.utf8)),
        ])
        let client = makeClient()
        // consentRecovery left nil (default) — mirrors mock/test wiring.

        do {
            try await client.post(path: "/v1/ai/chat", body: EmptyBody())
            XCTFail("expected httpError to propagate")
        } catch ProxyAPIError.httpError(let statusCode, _) {
            XCTAssertEqual(statusCode, 403)
        } catch {
            XCTFail("unexpected error: \(error)")
        }

        XCTAssertEqual(QueuedURLProtocol.requestCount, 1)
    }

    // MARK: putData

    func testPutConsent403TriggersRecoveryAndRetriesOnce() async throws {
        QueuedURLProtocol.reset([
            .init(statusCode: 403, body: Data(#"{"error":"consent required"}"#.utf8)),
            .init(statusCode: 200, body: Data("{}".utf8)),
        ])
        let client = makeClient()
        var recoveryCalls = 0
        client.consentRecovery = { recoveryCalls += 1 }

        try await client.put(path: "/v1/ai/chat", body: EmptyBody())

        XCTAssertEqual(recoveryCalls, 1)
        XCTAssertEqual(QueuedURLProtocol.requestCount, 2)
    }

    // MARK: postRawData

    func testPostRawConsent403TriggersRecoveryAndRetriesOnce() async throws {
        QueuedURLProtocol.reset([
            .init(statusCode: 403, body: Data(#"{"error":"consent required"}"#.utf8)),
            .init(statusCode: 200, body: Data("{}".utf8)),
        ])
        let client = makeClient()
        var recoveryCalls = 0
        client.consentRecovery = { recoveryCalls += 1 }

        let _: EmptyResponse = try await client.postRaw(
            path: "/v1/ai/audio", body: Data("bytes".utf8), contentType: "application/octet-stream"
        )

        XCTAssertEqual(recoveryCalls, 1)
        XCTAssertEqual(QueuedURLProtocol.requestCount, 2)
    }
}

private struct EmptyResponse: Decodable {}
