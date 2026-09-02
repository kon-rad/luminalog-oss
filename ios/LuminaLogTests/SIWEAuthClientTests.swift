import XCTest
@testable import LuminaLog

final class SIWEAuthClientTests: XCTestCase {

    private func makeSUT(handler: @escaping (URLRequest) -> (Data, HTTPURLResponse)) -> LiveSIWEAuthClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        StubURLProtocol.handler = handler
        let session = URLSession(configuration: config)
        return LiveSIWEAuthClient(
            baseURL: URL(string: "https://api.example.com")!,
            session: session,
            authenticatedClient: ProxyAPIClient(
                baseURL: URL(string: "https://api.example.com")!,
                tokenProvider: FixedTokenProvider(token: "test-id-token"),
                session: session
            )
        )
    }

    func testFetchNonceParsesNonceField() async throws {
        let sut = makeSUT { request in
            XCTAssertEqual(request.url?.path, "/v1/auth/siwe/nonce")
            XCTAssertEqual(request.httpMethod, "GET")
            let body = #"{"nonce":"abc123"}"#.data(using: .utf8)!
            return (body, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let nonce = try await sut.fetchNonce()
        XCTAssertEqual(nonce, "abc123")
    }

    func testVerifyPostsMessageAndSignatureReturnsCustomToken() async throws {
        let sut = makeSUT { request in
            XCTAssertEqual(request.url?.path, "/v1/auth/siwe/verify")
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertNil(request.value(forHTTPHeaderField: "Authorization")) // unauthenticated
            let body = #"{"firebaseCustomToken":"tok-123"}"#.data(using: .utf8)!
            return (body, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let token = try await sut.verify(message: "msg", signature: "0xsig")
        XCTAssertEqual(token, "tok-123")
    }

    func testVerifyThrowsOnNon2xx() async {
        let sut = makeSUT { request in
            let body = #"{"error":"Invalid signature"}"#.data(using: .utf8)!
            return (body, HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!)
        }
        do {
            _ = try await sut.verify(message: "msg", signature: "0xbad")
            XCTFail("expected an error")
        } catch {
            // any thrown error is acceptable; the important behavior is that it throws
        }
    }

    func testLinkUsesAuthenticatedClient() async throws {
        let sut = makeSUT { request in
            XCTAssertEqual(request.url?.path, "/v1/auth/siwe/link")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-id-token")
            let body = #"{"walletAddress":"0xabc"}"#.data(using: .utf8)!
            return (body, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let address = try await sut.link(message: "msg", signature: "0xsig")
        XCTAssertEqual(address, "0xabc")
    }
}

/// Minimal `URLProtocol` stub, request in / (data, response) out.
private final class StubURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (Data, HTTPURLResponse))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        guard let handler = Self.handler else { return }
        let (data, response) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

private final class FixedTokenProvider: TokenProvider {
    let token: String
    init(token: String) { self.token = token }
    func idToken(forceRefresh: Bool) async throws -> String { token }
}
