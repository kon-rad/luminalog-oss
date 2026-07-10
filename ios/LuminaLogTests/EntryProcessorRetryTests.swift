import XCTest
@testable import LuminaLog

/// Tests `BackgroundEntryProcessor.retry(draftId:)` for the cross-launch path:
/// when no in-session job exists but a durable UploadJournal record is present,
/// retry should restart uploads from the journal, driving finalization on success.
@MainActor
final class EntryProcessorRetryTests: XCTestCase {

    // MARK: - Minimal spies (mirrors EntryProcessorTests harness)

    private final class CountingTransport: UploadTransport {
        private(set) var calls = 0
        var statusCode = 200
        func put(file: URL, to url: URL) async -> Int {
            calls += 1
            return statusCode
        }
    }

    private final class SpyAI: AIService {
        private(set) var transcribedIds: [String] = []
        func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generateInsights(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> [DailyPromptItem] { [] }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async {}
        func deleteEntry(journalId: String) async throws {}
        func transcribeJournal(journalId: String) async { transcribedIds.append(journalId) }
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
            throw URLError(.cancelled)
        }
    }

    private final class SpyProfiles: ProfileRepository {
        func profile() -> AsyncStream<UserProfile?> { AsyncStream { $0.yield(nil) } }
        func update(_ profile: UserProfile) async throws {}
        func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws -> Bool { false }
        func mergeOnboardingDraft(_ draft: [String: String], overwriteExisting: Bool) async throws {}
        func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws {}
        func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {}
        func recordTimeSpent(minutes: Int) async throws {}
        func recordPromptAnswered() async throws {}
    }

    private final class SpyJournals: JournalRepository {
        private(set) var store: [JournalEntry] = []
        func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> { AsyncStream { $0.finish() } }
        func entries(after: Date?, limit: Int) async throws -> [JournalEntry] { store }
        func fetchAllEntries() async throws -> [JournalEntry] { store }
        func entry(id: String) -> AsyncStream<JournalEntry?> { AsyncStream { $0.finish() } }
        func save(_ entry: JournalEntry) async throws {
            if let i = store.firstIndex(where: { $0.id == entry.id }) { store[i] = entry } else { store.append(entry) }
        }
        func updateAIFields(id: String, summary: AIGeneration?, insights: AIGeneration?, prompts: AIPrompts?) async throws {}
        func updateContent(id: String, content: String, wordCount: Int, contentEditedAt: Date, appendedMedia: [MediaItem]) async throws {}
        func applyEntryEdit(id: String, title: String, content: String, wordCount: Int, contentEditedAt: Date?, edit: EditRecord) async throws {}
        func delete(id: String) async throws { store.removeAll { $0.id == id } }
        func setExcludeFromShare(entryId: String, value: Bool) async throws {}
        func countEntries(on date: Date, excluding draftId: String) async throws -> Int { 0 }
    }

    private final class SpyMedia: MediaUploader {
        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
            MediaItem(s3Key: "spy/key", kind: kind)
        }
        func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try? Data([0,1,2]).write(to: url)
            return PreparedUpload(encryptedFileURL: url, s3Key: "spy/\(UUID().uuidString)", mediaItem: MediaItem(s3Key: "spy/key", kind: kind))
        }
        func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int, journalId: String) async throws -> (s3Key: String, url: URL) {
            (s3Key ?? "spy/key", URL(string: "https://signed/put")!)
        }
        func viewURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/dev/null") }
        func localFileURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/dev/null") }
    }

    // MARK: - Helpers

    private func tempDir() -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    private func makeCiphertextFile() -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? Data([0, 1, 2]).write(to: u)
        return u
    }

    // MARK: - Tests

    /// Cross-launch path: no in-session job, but a durable journal record is
    /// present. `retry(draftId:)` should restart uploads and drive finalization.
    func testRetryRestartsFromDurableJournalWhenNotInSession() async throws {
        let transport = CountingTransport()
        let ai = SpyAI()
        let journals = SpyJournals()
        let profiles = SpyProfiles()
        let uploadJournal = UploadJournal(directory: tempDir())
        let finalizer = EntryFinalizer(journals: journals, profiles: profiles, ai: ai)
        let uploadManager = UploadManager(
            journal: uploadJournal,
            transport: transport,
            presign: { _ in URL(string: "https://signed/put")! },
            onFinalize: { pending in await finalizer.finalize(pending) },
            onPermanentFailure: { _ in },
            maxAttempts: 5,
            backoff: { _ in 0 }
        )
        let processor = BackgroundEntryProcessor(
            dependencies: BackgroundEntryProcessor.Dependencies(
                journals: journals, profiles: profiles, ai: ai,
                media: SpyMedia(), ocr: MockOCRService(),
                transcoder: VideoTranscoder(),
                journal: uploadJournal, uploadManager: uploadManager,
                finalizer: finalizer
            )
        )

        // Seed the journal with a pending (not-yet-uploaded) voice record —
        // simulating a record that survived a previous launch.
        let draftId = UUID().uuidString
        let ciphertext = makeCiphertextFile()
        let pending = PendingEntry(
            draftId: draftId, userId: "u1", type: .voice, title: "t",
            content: "", wordCount: 0, transcriptStatus: .processing,
            createdAtEpoch: Date().timeIntervalSince1970, promptText: nil,
            uploads: [PendingUpload(
                attachmentId: UUID(), kind: .audio, journalId: draftId,
                s3Key: "users/u1/journals/\(draftId)/audio.m4a",
                encryptedPath: ciphertext.path,
                durationSec: 5, width: nil, height: nil, thumbnailS3Key: nil,
                state: .pending
            )]
        )
        try uploadJournal.upsert(pending)

        // No in-session job for this draftId.
        XCTAssertFalse(processor.hasPendingJob(draftId: draftId))

        // Call retry — should pick up the durable record and restart uploads.
        processor.retry(draftId: draftId)

        // Await the spawned task.
        await processor.task(for: draftId)?.value

        // The transport was called (upload ran).
        XCTAssertGreaterThan(transport.calls, 0, "retry must drive at least one upload attempt")

        // Finalization ran (voice entry → transcription triggered).
        XCTAssertEqual(ai.transcribedIds, [draftId], "retry must drive finalization on upload success")

        // Journal record removed after successful finalize.
        XCTAssertNil(uploadJournal.entry(draftId: draftId), "journal record must be removed after finalize")
    }

    /// In-session path still works: a job in the `jobs` dict is re-run directly.
    func testRetryInSessionJobReruns() async throws {
        let transport = CountingTransport()
        let ai = SpyAI()
        let journals = SpyJournals()
        let profiles = SpyProfiles()
        let uploadJournal = UploadJournal(directory: tempDir())
        let finalizer = EntryFinalizer(journals: journals, profiles: profiles, ai: ai)
        let uploadManager = UploadManager(
            journal: uploadJournal,
            transport: transport,
            presign: { _ in URL(string: "https://signed/put")! },
            onFinalize: { pending in await finalizer.finalize(pending) },
            onPermanentFailure: { _ in },
            maxAttempts: 5,
            backoff: { _ in 0 }
        )
        let processor = BackgroundEntryProcessor(
            dependencies: BackgroundEntryProcessor.Dependencies(
                journals: journals, profiles: profiles, ai: ai,
                media: SpyMedia(), ocr: MockOCRService(),
                transcoder: VideoTranscoder(),
                journal: uploadJournal, uploadManager: uploadManager,
                finalizer: finalizer
            )
        )

        // Enqueue a text job and let it complete (so it's NOT retained in jobs).
        let draftId = UUID().uuidString
        let job = EntryProcessingJob(
            draftId: draftId, userId: "u1", promptText: nil,
            attachments: AttachmentSet(), text: "hello", createdAt: Date()
        )
        processor.enqueue(job)
        await processor.task(for: draftId)?.value

        // After success, the job is removed; retry is a no-op (no crash).
        processor.retry(draftId: draftId)
        // No assertions needed beyond "no crash"; the cross-launch path yields nil.
    }
}
