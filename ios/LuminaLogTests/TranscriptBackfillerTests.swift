import XCTest
@testable import LuminaLog

/// The on-launch transcript backfill: for voice/video entries whose transcript
/// failed or came back degenerate, re-transcribe from the S3 audio (source of
/// truth) and refresh the derived AI (summary/insights/prompts). `recover` (spied
/// here) already handles content/wordCount/index/goal; the backfiller's own job
/// is to regenerate the text AI that nothing else refreshes headlessly.
@MainActor
final class TranscriptBackfillerTests: XCTestCase {

    override func setUp() { super.setUp(); DevFlags.aiModel1 = true }
    override func tearDown() { DevFlags.aiModel1 = false; super.tearDown() }

    // A minimal AIService that returns a scripted entry-AI bundle and records ids.
    private final class SpyAI: AIService {
        private(set) var generateEntryAICalls: [String] = []
        var bundle = EntryAIBundle(
            summary: AIGeneration(text: "fresh summary", model: "m"),
            insights: AIGeneration(text: "fresh insights", model: "m"),
            prompts: AIPrompts(items: ["p1"], model: "m"))
        func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generateEntryAI(journalId: String) async throws -> EntryAIBundle {
            generateEntryAICalls.append(journalId); return bundle
        }
        func generateInsights(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> [DailyPromptItem] { [] }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async {}
        func deleteEntry(journalId: String) async throws {}
        func transcribeJournal(journalId: String) async throws {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport { throw URLError(.cancelled) }
    }

    private func degenerateVoiceEntry(id: String) -> JournalEntry {
        JournalEntry(id: id, userId: "u", type: .voice, title: "t", content: "So",
                     media: [MediaItem(s3Key: "\(id).m4a", kind: .audio, durationSec: 200)],
                     transcriptStatus: .failed, wordCount: 1)
    }

    func testRegeneratesDerivedAIForEachRecoveredEntry() async throws {
        let journals = MockJournalRepository(entries: [degenerateVoiceEntry(id: "e1")])
        let ai = SpyAI()
        let backfiller = TranscriptBackfiller(journals: journals, ai: ai, recover: { entry in
            var r = entry
            r.content = "a genuinely long and complete transcript of the recording"
            r.transcriptStatus = .ready
            return r
        })

        await backfiller.backfill()

        XCTAssertEqual(ai.generateEntryAICalls, ["e1"])
        let saved = try await journals.fetchAllEntries().first { $0.id == "e1" }
        XCTAssertEqual(saved?.summary?.text, "fresh summary", "derived AI must be refreshed")
    }

    func testSkipsDerivedAIWhenRecoveryFails() async throws {
        let journals = MockJournalRepository(entries: [degenerateVoiceEntry(id: "e1")])
        let ai = SpyAI()
        let backfiller = TranscriptBackfiller(journals: journals, ai: ai, recover: { _ in nil })

        await backfiller.backfill()

        XCTAssertTrue(ai.generateEntryAICalls.isEmpty, "no AI regen when re-transcription fails")
    }

    func testIgnoresEntriesThatDoNotNeedTranscript() async throws {
        // A plausible, ready voice transcript is not touched.
        let words = Array(repeating: "word", count: 80).joined(separator: " ")
        let healthy = JournalEntry(id: "ok", userId: "u", type: .voice, title: "t", content: words,
                                   media: [MediaItem(s3Key: "ok.m4a", kind: .audio, durationSec: 60)],
                                   transcriptStatus: .ready, wordCount: 80)
        let journals = MockJournalRepository(entries: [healthy])
        let ai = SpyAI()
        var recoverCalls = 0
        let backfiller = TranscriptBackfiller(journals: journals, ai: ai, recover: { e in recoverCalls += 1; return e })

        await backfiller.backfill()

        XCTAssertEqual(recoverCalls, 0, "healthy transcript must not be re-transcribed")
        XCTAssertTrue(ai.generateEntryAICalls.isEmpty)
    }
}
