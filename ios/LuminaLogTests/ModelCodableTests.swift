import XCTest
@testable import LuminaLog

/// Codable round-trips for the pure domain models.
final class ModelCodableTests: XCTestCase {

    private var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    /// Whole-second dates so ISO-8601 coding round-trips exactly.
    private let created = Date(timeIntervalSince1970: 1_760_000_000)
    private let updated = Date(timeIntervalSince1970: 1_760_003_600)

    func testJournalEntryRoundTripWithAllFields() throws {
        let entry = JournalEntry(
            id: "entry-1",
            userId: "user-1",
            type: .video,
            title: "Video note from the lake",
            createdAt: created,
            updatedAt: updated,
            content: "The dread before is always worse than the thing itself.",
            contentEditedAt: updated,
            media: [
                MediaItem(s3Key: "users/user-1/entry-1/a.mp4", kind: .video,
                          durationSec: 73.5, width: 1920, height: 1080),
                MediaItem(s3Key: "users/user-1/entry-1/b.jpg", kind: .image)
            ],
            transcriptStatus: .ready,
            summary: AIGeneration(text: "A summary.", generatedAt: created, model: "m1"),
            insights: AIGeneration(text: "Some insights.", generatedAt: created, model: "m1"),
            prompts: AIPrompts(items: ["One?", "Two?", "Three?", "Four?", "Five?"],
                               generatedAt: created, model: "m1"),
            vector: VectorState(status: .indexed, chunkCount: 3, indexedAt: created),
            wordCount: 10
        )

        let data = try encoder.encode(entry)
        let decoded = try decoder.decode(JournalEntry.self, from: data)
        XCTAssertEqual(decoded, entry)
    }

    func testJournalEntryRoundTripWithNilOptionals() throws {
        let entry = JournalEntry(
            id: "entry-2",
            userId: "user-1",
            type: .text,
            title: "Plain text",
            createdAt: created,
            updatedAt: created,
            content: "Just words.",
            wordCount: 2
        )

        let data = try encoder.encode(entry)
        let decoded = try decoder.decode(JournalEntry.self, from: data)
        XCTAssertEqual(decoded, entry)
        XCTAssertNil(decoded.summary)
        XCTAssertNil(decoded.transcriptStatus)
        XCTAssertNil(decoded.contentEditedAt)
    }

    func testUserProfileRoundTrip() throws {
        let profile = UserProfile(
            id: "user-1",
            displayName: "Demo User",
            email: "demo@luminalog.app",
            photoURL: URL(string: "https://example.com/avatar.png"),
            biography: "I journal to notice the small things.",
            createdAt: created,
            timezone: "America/Los_Angeles",
            stats: UserProfile.Stats(streakCount: 12, lastEntryDate: updated, totalWords: 24_310),
            dailyPrompt: UserProfile.DailyPrompt(text: "What would you protect three empty hours for?",
                                                 date: created,
                                                 sourceEntryIds: ["entry-1", "entry-2"])
        )

        let data = try encoder.encode(profile)
        let decoded = try decoder.decode(UserProfile.self, from: data)
        XCTAssertEqual(decoded, profile)
        XCTAssertEqual(decoded.dailyPrompt?.sourceEntryIds, ["entry-1", "entry-2"])
    }

    func testChatMessageRoundTripWithSources() throws {
        let message = ChatMessage(
            id: "msg-1",
            role: .assistant,
            text: "You wrote about the lake twice last month.",
            createdAt: created,
            sources: [
                MessageSource(journalId: "entry-1", snippet: "The dread before…"),
                MessageSource(journalId: "entry-2", snippet: "Back at the lake."),
            ]
        )

        let data = try encoder.encode(message)
        let decoded = try decoder.decode(ChatMessage.self, from: data)
        XCTAssertEqual(decoded, message)

        // nil sources stay nil through a round trip.
        let plain = ChatMessage(id: "msg-2", role: .user, text: "Hi", createdAt: created)
        let plainDecoded = try decoder.decode(ChatMessage.self, from: try encoder.encode(plain))
        XCTAssertEqual(plainDecoded, plain)
        XCTAssertNil(plainDecoded.sources)
    }
}
