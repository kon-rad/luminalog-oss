import XCTest
@testable import LuminaLog

@MainActor
final class InboxViewModelTests: XCTestCase {

    private var inboxService: MockInboxService!
    private var viewModel: InboxViewModel!
    private var drafter: MockInfoAnswerDrafter!
    private var now: Date!

    override func setUp() async throws {
        inboxService = MockInboxService()
        now = Date()
        drafter = MockInfoAnswerDrafter()
        viewModel = InboxViewModel(inboxService: inboxService, drafter: drafter)
    }

    override func tearDown() async throws {
        viewModel = nil
        drafter = nil
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
        viewModel = InboxViewModel(inboxService: throwingService)

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

    // MARK: - Payloads

    func testPayloadsSendBlankAndDeclinedQuestionsAsNil() {
        let payloads = InboxViewModel.payloads(
            questionCount: 3,
            answers: [0: "  Answer  ", 1: "   "],
            declined: [2]
        )
        XCTAssertEqual(payloads, [
            InfoAnswerPayload(index: 0, answer: "Answer"),
            InfoAnswerPayload(index: 1, answer: nil),
            InfoAnswerPayload(index: 2, answer: nil),
        ])
    }

    func testPayloadsDeclinedWinsOverTypedText() {
        let payloads = InboxViewModel.payloads(questionCount: 1, answers: [0: "typed"], declined: [0])
        XCTAssertEqual(payloads, [InfoAnswerPayload(index: 0, answer: nil)])
    }

    // MARK: - Drafting

    func testDraftReturnsOneAnswerPerQuestion() async {
        drafter.answers = ["A1", "A2"]
        let answers = await viewModel.draft(for: makeRequest(id: "r1"))
        XCTAssertEqual(answers, ["A1", "A2"])
        XCTAssertNil(viewModel.error)
    }

    func testDraftRejectsCountMismatch() async {
        drafter.answers = ["only one"]
        let answers = await viewModel.draft(for: makeRequest(id: "r1"))
        XCTAssertNil(answers)
        XCTAssertNotNil(viewModel.error)
    }

    func testDraftSurfacesError() async {
        drafter.error = NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "AI down"])
        let answers = await viewModel.draft(for: makeRequest(id: "r1"))
        XCTAssertNil(answers)
        XCTAssertEqual(viewModel.error, "AI down")
    }

    func testCanDraftFalseWithoutDrafter() {
        XCTAssertFalse(InboxViewModel(inboxService: inboxService).canDraft)
        XCTAssertTrue(viewModel.canDraft)
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