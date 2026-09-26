import XCTest
@testable import LuminaLog

// MARK: - Mocks

private final class MockSearcher: SemanticIndexCoordinating {
    var chunks: [ChunkRef] = []
    var searchResults: [String] = []

    func searchChunks(query: String, k: Int) async throws -> [ChunkRef] { chunks }
    func search(query: String, k: Int) async throws -> [String] { searchResults }
}

final class InfoAnswerDrafterTests: XCTestCase {

    private let api = ProxyAPIClient(
        baseURL: URL(string: "https://api.example.com")!,
        tokenProvider: InboxTokenProvider()
    )
    private let journals = MockJournalRepository()
    private let profiles = MockProfileRepository()
    private let searcher = MockSearcher()

    // MARK: - makeBody JSON structure

    func testMakeBodyProducesCorrectJSONStructure() throws {
        let sender = InfoRequestSender(
            address: "0xabc",
            ens: "alice.eth",
            name: "Alice",
            description: "A friendly request"
        )
        let request = InfoRequest(
            id: "req-1",
            sender: sender,
            reason: "Research",
            questions: ["What is your favorite color?", "How old are you?"],
            webhookHost: "https://hook.example.com/hook",
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(86400)
        )

        let details = UserProfile.ProfileDetails(
            goals: "Write daily",
            hobbies: "Reading",
            age: "30",
            gender: nil,
            challenges: nil,
            dailyHabits: nil,
            starSign: nil,
            maritalStatus: nil,
            location: "NYC",
            education: nil,
            work: nil,
            favoriteMovies: nil,
            favoriteArtists: nil,
            favoriteBooks: nil,
            languages: nil,
            friendsDescribe: nil
        )
        let profile = UserProfile(
            id: "uid-1",
            displayName: "Alice",
            biography: "A curious journaler",
            details: details
        )

        let contexts = ["I wrote about my day yesterday.", "I had coffee with a friend."]

        let body = InfoAnswerDrafter.makeBody(
            request: request,
            profile: profile,
            contexts: contexts
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(body)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        // Verify sender
        let jsonSender = try XCTUnwrap(json["sender"] as? [String: Any])
        XCTAssertEqual(jsonSender["address"] as? String, "0xabc")
        XCTAssertEqual(jsonSender["ens"] as? String, "alice.eth")
        XCTAssertEqual(jsonSender["name"] as? String, "Alice")
        XCTAssertEqual(jsonSender["description"] as? String, "A friendly request")

        // Verify name / bio / reason
        XCTAssertEqual(json["name"] as? String, "Alice")
        XCTAssertEqual(json["bio"] as? String, "A curious journaler")
        XCTAssertEqual(json["reason"] as? String, "Research")

        // Verify profile fields
        let jsonProfile = try XCTUnwrap(json["profile"] as? [String: String])
        XCTAssertEqual(jsonProfile["goals"], "Write daily")
        XCTAssertEqual(jsonProfile["hobbies"], "Reading")
        XCTAssertEqual(jsonProfile["age"], "30")
        XCTAssertEqual(jsonProfile["location"], "NYC")
        // nil fields should be absent
        XCTAssertNil(jsonProfile["gender"])
        XCTAssertNil(jsonProfile["challenges"])

        // Verify items (questions -> items mapping)
        let jsonItems = try XCTUnwrap(json["items"] as? [[String: Any]])
        XCTAssertEqual(jsonItems.count, 2)
        XCTAssertEqual(jsonItems[0]["index"] as? Int, 0)
        XCTAssertEqual(jsonItems[0]["question"] as? String, "What is your favorite color?")
        XCTAssertEqual(jsonItems[1]["index"] as? Int, 1)
        XCTAssertEqual(jsonItems[1]["question"] as? String, "How old are you?")

        // Verify contexts are included
        let jsonContexts = try XCTUnwrap(json["contexts"] as? [String])
        XCTAssertEqual(jsonContexts, contexts)
    }

    // MARK: - MockInfoAnswerDrafter

    func testMockDrafterReturnsPreconfiguredAnswers() async throws {
        let mock = MockInfoAnswerDrafter()
        let sender = InfoRequestSender(
            address: "0xabc", ens: nil, name: "Test", description: "Test"
        )
        let request = InfoRequest(
            id: "r-1",
            sender: sender,
            reason: "Testing",
            questions: ["Q1?"],
            webhookHost: "https://hook.example.com",
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(86400)
        )

        mock.answers = ["Answer A", "Answer B"]
        let result = try await mock.draftAnswers(for: request)
        XCTAssertEqual(result, ["Answer A", "Answer B"])
    }

    func testMockDrafterThrowsConfiguredError() async {
        let mock = MockInfoAnswerDrafter()
        let sender = InfoRequestSender(
            address: "0xabc", ens: nil, name: "Test", description: "Test"
        )
        let request = InfoRequest(
            id: "r-1",
            sender: sender,
            reason: "Testing",
            questions: ["Q1?"],
            webhookHost: "https://hook.example.com",
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(86400)
        )

        struct TestError: Error, Equatable {}
        mock.error = TestError()
        do {
            _ = try await mock.draftAnswers(for: request)
            XCTFail("Expected error to be thrown")
        } catch {
            XCTAssertEqual(error as? TestError, TestError())
        }
    }
}

// MARK: - Token provider (shared with InboxServiceTests)

private final class InboxTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}