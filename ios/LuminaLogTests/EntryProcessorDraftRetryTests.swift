import XCTest
@testable import LuminaLog

/// Verifies the rewritten `retry`: with no in-session job and no durable upload
/// record, it rebuilds the whole job from the durable draft and drives it to
/// `.ready` — the core fix for "Try again does nothing" after a relaunch.
@MainActor
final class EntryProcessorDraftRetryTests: XCTestCase {

    // MARK: Spies

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
        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport { throw URLError(.cancelled) }
    }
    private final class SpyProfiles: ProfileRepository {
        func profile() -> AsyncStream<UserProfile?> { AsyncStream { $0.yield(nil) } }
        func update(_ profile: UserProfile) async throws {}
        func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws -> Bool { false }
        func mergeOnboardingDraft(_ draft: [String: String], overwriteExisting: Bool) async throws {}
        func addTotalWords(delta: Int) async throws {}
        func reconcileDailyGoal(todayTotal: Int, now: Date) async throws {}
        func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {}
        func recordTimeSpent(minutes: Int) async throws {}
        func recordPromptAnswered() async throws {}
    }
    /// Yields the current stored entry on `entry(id:)` so `firstEntry` works.
    private final class SpyJournals: JournalRepository {
        var store: [JournalEntry] = []
        func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> { AsyncStream { $0.finish() } }
        func entries(after: Date?, limit: Int) async throws -> [JournalEntry] { store }
        func entriesToday(timezone: TimeZone) -> AsyncStream<[JournalEntry]> { AsyncStream { $0.finish() } }
        func fetchAllEntries() async throws -> [JournalEntry] { store }
        func entry(id: String) -> AsyncStream<JournalEntry?> {
            AsyncStream { cont in cont.yield(store.first { $0.id == id }); cont.finish() }
        }
        func save(_ entry: JournalEntry) async throws {
            if let i = store.firstIndex(where: { $0.id == entry.id }) { store[i] = entry } else { store.append(entry) }
        }
        func updateAIFields(id: String, summary: AIGeneration?, insights: AIGeneration?, prompts: AIPrompts?) async throws {}
        func updateCognitiveMap(id: String, map: CognitiveMapGeneration) async throws {}
        func updateContent(id: String, content: String, wordCount: Int, contentEditedAt: Date, appendedMedia: [MediaItem]) async throws {}
        func applyEntryEdit(id: String, title: String, content: String, wordCount: Int, contentEditedAt: Date?, edit: EditRecord) async throws {}
        func delete(id: String) async throws { store.removeAll { $0.id == id } }
        func setExcludeFromShare(entryId: String, value: Bool) async throws {}
        func countEntries(on date: Date, excluding draftId: String) async throws -> Int { 0 }
    }
    private final class SpyMedia: MediaUploader {
        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem { MediaItem(s3Key: "spy/key", kind: kind) }
        func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try? Data([0,1,2]).write(to: url)
            return PreparedUpload(encryptedFileURL: url, s3Key: "spy/\(UUID().uuidString)", mediaItem: MediaItem(s3Key: "spy/key", kind: kind))
        }
        func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int, journalId: String) async throws -> (s3Key: String, url: URL) { (s3Key ?? "spy/key", URL(string: "https://signed/put")!) }
        func viewURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/dev/null") }
        func localFileURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/dev/null") }
    }
    private final class CountingTransport: UploadTransport {
        private(set) var calls = 0
        func put(file: URL, to url: URL) async -> Int { calls += 1; return 200 }
    }

    private func tempDir() -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    private func makeProcessor(journals: SpyJournals, drafts: DraftStore, ai: SpyAI, transport: CountingTransport)
        -> BackgroundEntryProcessor {
        let profiles = SpyProfiles()
        let uploadJournal = UploadJournal(directory: tempDir())
        let finalizer = EntryFinalizer(journals: journals, profiles: profiles, ai: ai, drafts: drafts)
        let uploadManager = UploadManager(
            journal: uploadJournal, transport: transport,
            presign: { _ in URL(string: "https://signed/put")! },
            onFinalize: { pending in await finalizer.finalize(pending) },
            onPermanentFailure: { _ in }, maxAttempts: 5, backoff: { _ in 0 })
        return BackgroundEntryProcessor(dependencies: BackgroundEntryProcessor.Dependencies(
            journals: journals, profiles: profiles, ai: ai, media: SpyMedia(), ocr: MockOCRService(),
            transcoder: VideoTranscoder(), journal: uploadJournal, uploadManager: uploadManager,
            finalizer: finalizer, drafts: drafts))
    }

    func testRetryRebuildsTextEntryFromDraftAfterRelaunch() async throws {
        let journals = SpyJournals()
        let ai = SpyAI()
        let transport = CountingTransport()
        let drafts = DraftStore(directory: tempDir())
        let draftId = UUID().uuidString

        // A failed entry (as left by a previous launch) + its retained handed-off draft.
        try await journals.save(JournalEntry(id: draftId, userId: "u1", type: .text,
            title: "t", createdAt: Date(), content: "hello", media: [],
            transcriptStatus: nil, processingStatus: .failed, wordCount: 1))
        var draft = DraftEntry(draftId: draftId, text: "hello", promptText: nil,
            createdAtEpoch: Date().timeIntervalSince1970, updatedAtEpoch: Date().timeIntervalSince1970,
            attachments: [])
        draft.handedOff = true
        drafts.upsert(draft)

        let processor = makeProcessor(journals: journals, drafts: drafts, ai: ai, transport: transport)
        XCTAssertFalse(processor.hasPendingJob(draftId: draftId))   // no in-session job

        processor.retry(draftId: draftId)
        await processor.task(for: draftId)?.value

        XCTAssertEqual(journals.store.first(where: { $0.id == draftId })?.processingStatus, .ready,
                       "rebuild must drive the entry to .ready")
        XCTAssertNil(drafts.load(draftId), "draft deleted after successful rebuild")
    }

    func testRetryNoOpsWhenNoEntryAndNoSources() async throws {
        let journals = SpyJournals()   // empty
        let ai = SpyAI()
        let processor = makeProcessor(journals: journals, drafts: DraftStore(directory: tempDir()),
                                      ai: ai, transport: CountingTransport())
        processor.retry(draftId: "missing")
        await processor.task(for: "missing")?.value
        XCTAssertTrue(journals.store.isEmpty)   // nothing created; safe no-op
    }
}
