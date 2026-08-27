import XCTest
@testable import LuminaLog

/// Fixed-token provider so `ProxyAPIClient` can build authed requests offline.
/// A local copy: the identical helper in `Model1ReroutingTests` is file-private.
private final class PollingStubTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

/// Serves a scripted sequence of responses, one per request, so a test can walk the
/// poll loop through pending and out the other side. Also records every path requested,
/// which is how we assert the loop actually polled rather than answering from the POST.
final class ScriptedURLProtocol: URLProtocol {

    nonisolated(unsafe) static var responses: [(status: Int, json: String)] = []
    nonisolated(unsafe) static var requestedPaths: [String] = []
    nonisolated(unsafe) static var requestedTimeouts: [TimeInterval] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requestedPaths.append(request.url?.path ?? "")
        Self.requestedTimeouts.append(request.timeoutInterval)
        let next = Self.responses.isEmpty
            ? (status: 500, json: #"{"error":"script exhausted"}"#)
            : Self.responses.removeFirst()
        let response = HTTPURLResponse(
            url: request.url!, statusCode: next.status, httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(next.json.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    static func reset() {
        responses = []
        requestedPaths = []
        requestedTimeouts = []
    }
}

final class EntryMapPollingTests: XCTestCase {

    private var savedFlag = false

    override func setUp() {
        super.setUp()
        savedFlag = DevFlags.aiModel1
        DevFlags.aiModel1 = true
        ScriptedURLProtocol.reset()
    }

    override func tearDown() {
        DevFlags.aiModel1 = savedFlag
        ScriptedURLProtocol.reset()
        super.tearDown()
    }

    private static let ticket = #"{"jobId":"job-1","status":"pending"}"#
    private static let pending = #"{"status":"pending"}"#
    private static let done = #"""
    {"status":"done","v":1,"beats":[{"id":"b0","tier":"map","kind":"event","text":"Signed up","quote":"Signed up.","quoteStart":0,"domain":"craft","isSpine":true,"isKeeper":false,"generality":0.1,"keepScore":0.2,"degree":0,"mentions":[]}],"edges":[],"model":"glm-5.2","generatedAt":"2026-08-24T10:00:00Z"}
    """#

    @MainActor
    private func makeService(ceiling: TimeInterval = 5) -> ProxyAIService {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ScriptedURLProtocol.self]
        let api = ProxyAPIClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: PollingStubTokenProvider(),
            session: URLSession(configuration: config)
        )
        let entry = JournalEntry(
            id: "e1", userId: "u", type: .text, title: "T", content: "Signed up."
        )
        return ProxyAIService(
            api: api,
            journals: MockJournalRepository(entries: [entry]),
            mapPollInterval: 0.01,
            mapPollCeiling: ceiling
        )
    }

    @MainActor
    func testPollsPastPendingAndReturnsTheMap() async throws {
        ScriptedURLProtocol.responses = [
            (202, Self.ticket), (200, Self.pending), (200, Self.pending), (200, Self.done),
        ]

        let generation = try await makeService().generateEntryMap(journalId: "e1")

        XCTAssertEqual(generation.map.beats.count, 1)
        XCTAssertEqual(generation.model, "glm-5.2")
        XCTAssertEqual(ScriptedURLProtocol.requestedPaths.count, 4)
        XCTAssertEqual(ScriptedURLProtocol.requestedPaths.first, "/v1/ai/entry-map")
        XCTAssertEqual(ScriptedURLProtocol.requestedPaths.last, "/v1/ai/entry-map/job-1")
    }

    @MainActor
    func testThrowsWhenTheJobFails() async {
        ScriptedURLProtocol.responses = [
            (202, Self.ticket), (200, #"{"status":"failed","error":"every model refused"}"#),
        ]

        do {
            _ = try await makeService().generateEntryMap(journalId: "e1")
            XCTFail("expected a failed job to throw")
        } catch {
            // Two requests and no more: a failed job must stop the loop, not retry it.
            XCTAssertEqual(ScriptedURLProtocol.requestedPaths.count, 2)
        }
    }

    @MainActor
    func testThrowsWhenTheCeilingIsReached() async {
        ScriptedURLProtocol.responses = [(202, Self.ticket)]
            + Array(repeating: (200, Self.pending), count: 200)

        do {
            _ = try await makeService(ceiling: 0.05).generateEntryMap(journalId: "e1")
            XCTFail("expected the ceiling to throw")
        } catch {
            XCTAssertGreaterThan(ScriptedURLProtocol.requestedPaths.count, 1)
        }
    }

    @MainActor
    func testJSONRequestsGetTheGenerousTimeout() async throws {
        ScriptedURLProtocol.responses = [(202, Self.ticket), (200, Self.done)]

        _ = try await makeService().generateEntryMap(journalId: "e1")

        // 60s is URLSession's default and is not enough for an AI route. The raw
        // transcription path already sets 120; the JSON path never did.
        XCTAssertFalse(ScriptedURLProtocol.requestedTimeouts.isEmpty)
        XCTAssertTrue(ScriptedURLProtocol.requestedTimeouts.allSatisfy { $0 == 120 })
    }
}
