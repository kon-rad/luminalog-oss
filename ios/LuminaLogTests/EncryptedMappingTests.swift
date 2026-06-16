import XCTest
import CryptoKit
@testable import LuminaLog

final class EncryptedMappingTests: XCTestCase {

    private let cipher = FieldCipher(key: SymmetricKey(size: .bits256))
    private let created = Date(timeIntervalSince1970: 1_760_000_000)

    func testJournalEntryEncryptsContentAndDecodesBack() throws {
        let entry = JournalEntry(
            id: "e1", userId: "u1", type: .text, title: "My Title",
            createdAt: created, updatedAt: created,
            content: "Secret entry body.", wordCount: 3
        )
        let data = try entry.firestoreData(cipher: cipher)

        // Sensitive fields are envelopes, not plaintext.
        XCTAssertNil(data["content"] as? String)
        XCTAssertNotNil(EncryptedField(data: data["content"]))
        XCTAssertNil(data["title"] as? String)
        XCTAssertNotNil(EncryptedField(data: data["title"]))
        // Query keys stay plaintext.
        XCTAssertEqual(data["userId"] as? String, "u1")
        XCTAssertEqual(data["type"] as? String, "text")

        let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.content, "Secret entry body.")
        XCTAssertEqual(decoded.title, "My Title")
    }

    func testJournalEntryRoundTripsProcessingStatus() throws {
        let entry = JournalEntry(
            id: "e1", userId: "u1", type: .voice, title: "t",
            createdAt: created, updatedAt: created, content: "c",
            transcriptStatus: .processing, processingStatus: .uploading, wordCount: 1
        )
        let data = try entry.firestoreData(cipher: cipher)

        // Status flag stays plaintext (it's a non-sensitive query/UI key).
        XCTAssertEqual(data["processingStatus"] as? String, "uploading")

        let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.processingStatus, .uploading)
        XCTAssertEqual(decoded.transcriptStatus, .processing)
    }

    func testJournalEntryOmitsNilProcessingStatus() throws {
        let entry = JournalEntry(
            id: "e1", userId: "u1", type: .text, title: "t",
            createdAt: created, updatedAt: created, content: "c", wordCount: 1
        )
        let data = try entry.firestoreData(cipher: cipher)
        XCTAssertNil(data["processingStatus"], "Legacy/complete entries write no status field")

        let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
        XCTAssertNil(decoded.processingStatus)
    }

    func testJournalEntryEncryptsAIGenerations() throws {
        let entry = JournalEntry(
            id: "e1", userId: "u1", type: .text, title: "t",
            createdAt: created, updatedAt: created, content: "c",
            summary: AIGeneration(text: "A summary.", generatedAt: created, model: "m"),
            prompts: AIPrompts(items: ["Q1?", "Q2?"], generatedAt: created, model: "m"),
            wordCount: 1
        )
        let data = try entry.firestoreData(cipher: cipher)
        let summaryDict = try XCTUnwrap(data["summary"] as? [String: Any])
        XCTAssertNotNil(EncryptedField(data: summaryDict["text"]))
        XCTAssertEqual(summaryDict["model"] as? String, "m")   // metadata stays plaintext

        let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.summary?.text, "A summary.")
        XCTAssertEqual(decoded.prompts?.items, ["Q1?", "Q2?"])
    }

    func testChatMessageEncryptsTextAndSnippets() throws {
        let message = ChatMessage(
            id: "m1", role: .assistant, text: "Reply text.", createdAt: created,
            sources: [MessageSource(journalId: "e1", snippet: "snippet text")]
        )
        let data = try message.firestoreData(cipher: cipher)
        XCTAssertNotNil(EncryptedField(data: data["text"]))
        let sources = try XCTUnwrap(data["sources"] as? [[String: Any]])
        XCTAssertEqual(sources.first?["journalId"] as? String, "e1")   // id plaintext
        XCTAssertNotNil(EncryptedField(data: sources.first?["snippet"]))

        let decoded = try XCTUnwrap(ChatMessage(documentId: "m1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.text, "Reply text.")
        XCTAssertEqual(decoded.sources?.first?.snippet, "snippet text")
    }

    func testChatEncryptsTitle() throws {
        let chat = Chat(id: "c1", userId: "u1", kind: .text, title: "Chat Title",
                        createdAt: created, lastMessageAt: created, vapiCallId: nil)
        let data = try chat.firestoreData(cipher: cipher)
        XCTAssertNotNil(EncryptedField(data: data["title"]))
        let decoded = try XCTUnwrap(Chat(documentId: "c1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.title, "Chat Title")
    }

    func testProfileEncryptsBiographyAndDailyPrompt() throws {
        let profile = UserProfile(
            id: "u1", displayName: "Demo", email: "d@e.com", photoURL: nil,
            biography: "My private bio.", createdAt: created, timezone: "UTC",
            stats: UserProfile.Stats(streakCount: 0, lastEntryDate: nil, totalWords: 0),
            dailyPrompt: UserProfile.DailyPrompt(text: "Prompt?", date: created, sourceEntryIds: nil)
        )
        let data = try profile.firestoreData(cipher: cipher)
        XCTAssertNotNil(EncryptedField(data: data["biography"]))
        XCTAssertEqual(data["email"] as? String, "d@e.com")   // PII stays plaintext
        let dp = try XCTUnwrap(data["dailyPrompt"] as? [String: Any])
        XCTAssertNotNil(EncryptedField(data: dp["text"]))

        let decoded = UserProfile(documentId: "u1", data: data, cipher: cipher)
        XCTAssertEqual(decoded.biography, "My private bio.")
        XCTAssertEqual(decoded.dailyPrompt?.text, "Prompt?")
    }
}
