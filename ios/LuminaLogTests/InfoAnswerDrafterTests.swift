import XCTest
@testable import LuminaLog

@MainActor
final class InfoAnswerDrafterTests: XCTestCase {

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

        // Top-level keys match the server's BODY_SCHEMA exactly.
        XCTAssertEqual(Set(json.keys), ["name", "bio", "profile", "sender", "reason", "items"])

        // Sender carries only what the model sees: name + description.
        let jsonSender = try XCTUnwrap(json["sender"] as? [String: Any])
        XCTAssertEqual(Set(jsonSender.keys), ["name", "description"])
        XCTAssertEqual(jsonSender["name"] as? String, "Alice")
        XCTAssertEqual(jsonSender["description"] as? String, "A friendly request")

        XCTAssertEqual(json["name"] as? String, "Alice")
        XCTAssertEqual(json["bio"] as? String, "A curious journaler")
        XCTAssertEqual(json["reason"] as? String, "Research")

        let jsonProfile = try XCTUnwrap(json["profile"] as? [String: String])
        XCTAssertEqual(jsonProfile["goals"], "Write daily")
        XCTAssertEqual(jsonProfile["hobbies"], "Reading")
        XCTAssertEqual(jsonProfile["age"], "30")
        XCTAssertEqual(jsonProfile["location"], "NYC")
        XCTAssertNil(jsonProfile["gender"])
        XCTAssertNil(jsonProfile["challenges"])

        // One item per question, each with its own journal context.
        let jsonItems = try XCTUnwrap(json["items"] as? [[String: String]])
        XCTAssertEqual(jsonItems, [
            ["question": "What is your favorite color?", "journalContext": "I wrote about my day yesterday."],
            ["question": "How old are you?", "journalContext": "I had coffee with a friend."],
        ])
    }

    func testMakeBodyPadsMissingContextsWithEmptyString() throws {
        let request = InfoRequest(
            id: "req-2",
            sender: InfoRequestSender(address: "0xabc", ens: nil, name: "Bob", description: "Agent"),
            reason: "Survey",
            questions: ["Q1?", "Q2?"],
            webhookHost: "hook.example.com",
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(86400)
        )
        let body = InfoAnswerDrafter.makeBody(
            request: request,
            profile: UserProfile(id: "uid", displayName: "Bob", biography: ""),
            contexts: ["only one"]
        )
        XCTAssertEqual(body.items.map(\.journalContext), ["only one", ""])
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
