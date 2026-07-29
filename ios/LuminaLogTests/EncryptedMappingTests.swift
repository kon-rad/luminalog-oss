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

    func testJournalEntryRoundTripsEditHistory() throws {
        let edited = Date(timeIntervalSince1970: 1_760_500_000)
        let entry = JournalEntry(
            id: "e1", userId: "u1", type: .text, title: "t",
            createdAt: created, updatedAt: created, content: "c",
            editHistory: [EditRecord(editedAt: edited, fields: ["title", "content"])],
            wordCount: 1
        )
        let data = try entry.firestoreData(cipher: cipher)

        // Edit history is metadata — stored plaintext (not an encrypted envelope).
        let raw = try XCTUnwrap(data["editHistory"] as? [[String: Any]])
        XCTAssertEqual(raw.first?["fields"] as? [String], ["title", "content"])

        let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.editHistory.count, 1)
        XCTAssertEqual(decoded.editHistory.first?.fields, ["title", "content"])
        XCTAssertEqual(decoded.editHistory.first?.editedAt, edited)
    }

    func testJournalEntryOmitsEmptyEditHistory() throws {
        let entry = JournalEntry(
            id: "e1", userId: "u1", type: .text, title: "t",
            createdAt: created, updatedAt: created, content: "c", wordCount: 1
        )
        let data = try entry.firestoreData(cipher: cipher)
        XCTAssertNil(data["editHistory"], "Entries with no edits write no editHistory field")
        let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.editHistory, [])
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

    func testDailyReportEncryptsTextFieldsAndRoundTrips() throws {
        // Guards the client-side persistence added for the zero-knowledge path:
        // the server returns the card but never stores it, so the client must be
        // able to encrypt it and read it back (otherwise a freshly generated card
        // never appears in Home's feed).
        let report = DailyInsightsReport(
            id: "2026-06-22_1717",
            date: "2026-06-22",
            findings: "Private finding.",
            gem: "Rest is\nwhere the steady\nprogress hides.",
            emotionSummary: "Calm and hopeful.",
            totalWords: 12_480, wordsToday: 812, streakCount: 7,
            emotions: [.init(name: "Calmness", score: 0.82)],
            imageQuery: "calm water",
            sourceEntryIds: ["e1"], model: "m",
            generatedAt: created
        )
        let data = try report.firestoreData(cipher: cipher)

        // Sensitive text fields are envelopes, not plaintext. `gem` seals under the
        // legacy `question` key so it decodes with the existing read path.
        XCTAssertNil(data["question"] as? String)
        XCTAssertNotNil(EncryptedField(data: data["question"]))
        XCTAssertNotNil(EncryptedField(data: data["findings"]))
        XCTAssertNotNil(EncryptedField(data: data["emotionSummary"]))
        // Stats/metadata stay plaintext.
        XCTAssertEqual(data["streakCount"] as? Int, 7)
        XCTAssertEqual(data["date"] as? String, "2026-06-22")

        // `id` is the document id (not part of the body), so pass it on read.
        let decoded = try DailyInsightsReport(firestore: data, id: report.id, cipher: cipher)
        XCTAssertEqual(decoded, report)
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
