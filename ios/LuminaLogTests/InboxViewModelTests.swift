import XCTest
@testable import LuminaLog

@MainActor
final class InboxViewModelTests: XCTestCase {

    private var inboxService: MockInboxService!
    private var viewModel: InboxViewModel!
    private var now: Date!

    override func setUp() async throws {
        inboxService = MockInboxService()
        now = Date()
        viewModel = InboxViewModel(
            inboxService: inboxService,
            now: { self.now }
        )
    }

    override func tearDown() async throws {
        viewModel = nil
        inboxService = nil
        now = nil
    }

    // MARK: - Loading

    func testLoadPopulatesRequests() async {
        let request = makeRequest(id: "r1")
        inboxService.requests = [request]

        await viewModel.load()

        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
        XCTAssertEqual(viewModel.requests.count, 1)
        XCTAssertEqual(viewModel.requests.first?.id, "r1")
    }

    func testLoadSetsErrorOnFailure() async {
        struct TestError: Error, LocalizedError {
            var errorDescription: String? { "Network error" }
        }
        inboxService.respondError = TestError()

        // Inject a throwing service
        let throwingService = ThrowingInboxService()
        viewModel = InboxViewModel(inboxService: throwingService, now: { self.now })

        await viewModel.load()

        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNotNil(viewModel.error)
        XCTAssertTrue(viewModel.requests.isEmpty)
    }

    // MARK: - Ignore

    func testIgnoreRemovesFromList() async {
        let request = makeRequest(id: "r1")
        inboxService.requests = [request]
        await viewModel.load()

        XCTAssertEqual(viewModel.requests.count, 1)

        await viewModel.ignore("r1")

        XCTAssertTrue(viewModel.requests.isEmpty)
        XCTAssertNil(viewModel.error)
        XCTAssertEqual(inboxService.ignoredIds, ["r1"])
    }

    // MARK: - Respond

    func testRespondRemovesRequestOnSuccess() async {
        let request = makeRequest(id: "r1")
        inboxService.requests = [request]
        await viewModel.load()

        let answers = [
            InfoAnswerPayload(index: 0, answer: "Answer 1"),
            InfoAnswerPayload(index: 1, answer: "Answer 2")
        ]

        let result = await viewModel.respond("r1", answers: answers)

        XCTAssertTrue(result)
        XCTAssertTrue(viewModel.requests.isEmpty)
    }

    func testRespondReturnsFalseOnFailure() async {
        let request = makeRequest(id: "r1")
        inboxService.requests = [request]
        inboxService.respondError = NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Delivery failed"])
        await viewModel.load()

        let answers = [InfoAnswerPayload(index: 0, answer: "Answer")]

        let result = await viewModel.respond("r1", answers: answers)

        XCTAssertFalse(result)
        // Request should still be in the list
        XCTAssertEqual(viewModel.requests.count, 1)
    }

    // MARK: - Helpers

    private func makeRequest(id: String) -> InfoRequest {
        InfoRequest(
            id: id,
            sender: InfoRequestSender(
                address: "0x1234567890abcdef1234567890abcdef12345678",
                ens: nil,
                name: "Agent",
                description: "Test agent"
            ),
            reason: "Test reason",
            questions: ["Q1?", "Q2?"],
            webhookHost: "agent.example.com",
            createdAt: now.addingTimeInterval(-3600),
            expiresAt: now.addingTimeInterval(86400 * 29)
        )
    }
}

/// Helper: an InboxService that always throws on pending().
private final class ThrowingInboxService: InboxService {
    func pending() async throws -> [InfoRequest] {
        throw NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Network error"])
    }
    func ignore(id: String) async throws {
        throw NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Ignore failed"])
    }
    func respond(id: String, answers: [InfoAnswerPayload]) async throws -> RespondResult {
        throw NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Respond failed"])
    }
    func checkUsername(_ username: String) async throws -> UsernameCheck {
        throw NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Check failed"])
    }
    func setUsername(_ username: String) async throws -> UsernameUpdate {
        throw NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Set failed"])
    }
}