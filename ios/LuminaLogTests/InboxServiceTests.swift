import XCTest
@testable import LuminaLog

// MARK: - Stub URLProtocol

private final class InboxStubURLProtocol: URLProtocol {
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

private final class InboxTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

final class InboxServiceTests: XCTestCase {

    private func makeProxy() -> ProxyInboxService {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [InboxStubURLProtocol.self]
        let session = URLSession(configuration: config)
        let api = ProxyAPIClient(
            baseURL: URL(string: "https://api.example.com")!,
            tokenProvider: InboxTokenProvider(),
            session: session
        )
        return ProxyInboxService(api: api)
    }

    // MARK: - Date precision

    func testPendingDecodesSecondPrecisionDates() async throws {
        let sut = makeProxy()
        let json = """
        {
            "requests": [
                {
                    "id": "req-1",
                    "sender": {
                        "address": "0x1234567890abcdef1234567890abcdef12345678",
                        "name": "Alice",
                        "description": "A friendly request"
                    },
                    "reason": "Research",
                    "questions": ["What is your favorite color?"],
                    "webhookHost": "https://example.com/hook",
                    "createdAt": "2026-09-27T12:00:00Z",
                    "expiresAt": "2026-10-27T12:00:00Z"
                }
            ]
        }
        """.data(using: .utf8)!

        InboxStubURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/v1/inbox")
            return (json, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }

        let result = try await sut.pending()
        XCTAssertEqual(result.count, 1)
        let request = try XCTUnwrap(result.first)
        XCTAssertEqual(request.id, "req-1")
        // ISO8601 dates with second precision should decode without millisecond requirements
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let expectedDate = try XCTUnwrap(formatter.date(from: "2026-09-27T12:00:00Z"))
        // Compare as time intervals since seconds precision and fractional seconds may differ
        XCTAssertEqual(floor(request.createdAt.timeIntervalSince1970), floor(expectedDate.timeIntervalSince1970))
    }

    // MARK: - Verified identity

    func testVerifiedIdentityPrefersENS() {
        let senderWithENS = InfoRequestSender(
            address: "0x1234567890abcdef1234567890abcdef12345678",
            ens: "alice.eth",
            name: "Alice",
            description: "Test"
        )
        XCTAssertEqual(senderWithENS.verifiedIdentity, "alice.eth")

        let senderWithoutENS = InfoRequestSender(
            address: "0x1234567890abcdef1234567890abcdef12345678",
            ens: nil,
            name: "Bob",
            description: "Test"
        )
        XCTAssertEqual(senderWithoutENS.verifiedIdentity, "0x1234...5678")
    }

    func testVerifiedIdentityPrefersENSEvenWhenEmptyENS() {
        let senderEmptyENS = InfoRequestSender(
            address: "0x1234567890abcdef1234567890abcdef12345678",
            ens: "",
            name: "Charlie",
            description: "Test"
        )
        XCTAssertEqual(senderEmptyENS.verifiedIdentity, "0x1234...5678")
    }

    // MARK: - Respond encoding

    func testRespondEncodesDeclinedAsMissingAnswer() throws {
        let payload = InfoAnswerPayload(index: 0, answer: nil)
        let encoder = JSONEncoder()
        let data = try encoder.encode(payload)
        let jsonObj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let jsonDict = try XCTUnwrap(jsonObj)
        XCTAssertEqual(jsonDict["index"] as? Int, 0)
        // answer should be absent (not null) when nil
        XCTAssertNil(jsonDict["answer"])
    }

    func testRespondEncodesAnsweredAsString() throws {
        let payload = InfoAnswerPayload(index: 1, answer: "Blue")
        let encoder = JSONEncoder()
        let data = try encoder.encode(payload)
        let jsonObj2 = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let jsonDict2 = try XCTUnwrap(jsonObj2)
        XCTAssertEqual(jsonDict2["index"] as? Int, 1)
        XCTAssertEqual(jsonDict2["answer"] as? String, "Blue")
    }

    // MARK: - UsernameError mapping

    func testUsernameErrorMapping() {
        // tooSoon with nextChangeAt
        let body = #"{"error":"too_soon","nextChangeAt":"2026-10-01T00:00:00Z"}"#
        let httpError = ProxyAPIError.httpError(statusCode: 400, body: body)
        let tooSoonError = UsernameError.from(httpError)
        if case .tooSoon(let date) = tooSoonError {
            XCTAssertNotNil(date)
        } else {
            XCTFail("Expected tooSoon with date, got \(tooSoonError)")
        }

        // invalid
        let invalidBody = #"{"error":"invalid"}"#
        let invalidError = ProxyAPIError.httpError(statusCode: 400, body: invalidBody)
        if case .invalid = UsernameError.from(invalidError) {
            // pass
        } else {
            XCTFail("Expected invalid")
        }

        // reserved
        let reservedBody = #"{"error":"reserved"}"#
        let reservedError = ProxyAPIError.httpError(statusCode: 400, body: reservedBody)
        if case .reserved = UsernameError.from(reservedError) {
            // pass
        } else {
            XCTFail("Expected reserved")
        }

        // taken
        let takenBody = #"{"error":"taken"}"#
        let takenError = ProxyAPIError.httpError(statusCode: 400, body: takenBody)
        if case .taken = UsernameError.from(takenError) {
            // pass
        } else {
            XCTFail("Expected taken")
        }

        // unknown error string
        let unknownBody = #"{"error":"something_else"}"#
        let unknownError = ProxyAPIError.httpError(statusCode: 400, body: unknownBody)
        if case .unknown = UsernameError.from(unknownError) {
            // pass
        } else {
            XCTFail("Expected unknown")
        }

        // non-httpError
        let otherError = NSError(domain: "test", code: 0)
        if case .unknown = UsernameError.from(otherError) {
            // pass
        } else {
            XCTFail("Expected unknown for non-httpError")
        }
    }

    // MARK: - UserProfile mapping

    func testUserProfileMapsUsername() {
        let profile = UserProfile(
            id: "test-uid",
            displayName: "Test User",
            email: "test@example.com",
            username: "testuser",
            usernameChangedAt: Date(timeIntervalSince1970: 1000000)
        )
        XCTAssertEqual(profile.username, "testuser")
        XCTAssertEqual(profile.usernameChangedAt?.timeIntervalSince1970, 1000000)
    }

    func testUserProfileMapsNilUsername() {
        let profile = UserProfile(id: "test-uid")
        XCTAssertNil(profile.username)
        XCTAssertNil(profile.usernameChangedAt)
    }

    // MARK: - MockInboxService

    func testMockInboxServiceReturnsPreconfiguredRequests() async throws {
        let mock = MockInboxService()
        let sender = InfoRequestSender(
            address: "0xabc",
            ens: nil,
            name: "Mock",
            description: "Mock sender"
        )
        let request = InfoRequest(
            id: "mock-1",
            sender: sender,
            reason: "Testing",
            questions: ["Q1?"],
            webhookHost: "https://hook.example.com",
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(86400)
        )
        mock.requests = [request]

        let result = try await mock.pending()
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "mock-1")
    }

    func testMockInboxServiceTracksIgnoredIds() async throws {
        let mock = MockInboxService()
        try await mock.ignore(id: "req-1")
        try await mock.ignore(id: "req-2")
        XCTAssertEqual(mock.ignoredIds, ["req-1", "req-2"])
    }

    func testMockInboxServiceTracksRespondedAnswers() async throws {
        let mock = MockInboxService()
        let result = try await mock.respond(id: "req-1", answers: [
            InfoAnswerPayload(index: 0, answer: "Yes"),
            InfoAnswerPayload(index: 1, answer: nil),
        ])
        XCTAssertTrue(result.delivered)
        XCTAssertEqual(mock.respondedAnswers.count, 1)
        XCTAssertEqual(mock.respondedAnswers["req-1"]?.count, 2)
    }

    func testMockInboxServiceThrowsConfiguredError() async {
        let mock = MockInboxService()
        mock.respondError = ProxyAPIError.httpError(statusCode: 403, body: "Forbidden")
        do {
            _ = try await mock.respond(id: "req-1", answers: [])
            XCTFail("Expected error to be thrown")
        } catch {
            XCTAssertTrue(error is ProxyAPIError)
        }
    }

    func testMockInboxUsernameCheck() async throws {
        let mock = MockInboxService()
        mock.checkResult = UsernameCheck(username: "testuser", available: true, reason: nil)
        let result = try await mock.checkUsername("testuser")
        XCTAssertEqual(result.username, "testuser")
        XCTAssertTrue(result.available)
    }

    func testMockInboxUsernameSet() async throws {
        let mock = MockInboxService()
        let date = Date()
        mock.setResult = .success(UsernameUpdate(
            username: "newuser",
            usernameChangedAt: date,
            nextChangeAt: date.addingTimeInterval(86400 * 30)
        ))
        let result = try await mock.setUsername("newuser")
        XCTAssertEqual(result.username, "newuser")
        XCTAssertEqual(result.usernameChangedAt, date)
        XCTAssertEqual(mock.checkedNames, ["newuser"])
    }
}