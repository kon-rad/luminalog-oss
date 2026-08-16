import XCTest
@testable import LuminaLog

/// The background pipeline that runs after the Create screen is dismissed:
/// writes a placeholder entry, derives content (OCR), uploads media, saves, and
/// hands voice/video off to server transcription — updating `processingStatus`
/// at each step and retaining failed jobs for in-session retry.
final class EntryProcessorTests: XCTestCase {

    // These tests cover the server-side transcription branch (voice/video hand
    // off to Whisper), which is the `aiModel1 == false` path. The app registers
    // `aiModel1 = true` as a default and other suites flip it on, so pin it off
    // here and restore, so these tests exercise the branch they were written for.
    private var savedAIModel1 = false
    override func setUp() {
        super.setUp()
        savedAIModel1 = DevFlags.aiModel1
        DevFlags.aiModel1 = false
    }
    override func tearDown() {
        DevFlags.aiModel1 = savedAIModel1
        super.tearDown()
    }

    // MARK: - Spies

    @MainActor
    private final class SpyAIService: AIService {
        private(set) var indexedJournalIds: [String] = []
        private(set) var transcribedJournalIds: [String] = []

        func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generateInsights(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> [DailyPromptItem] { [] }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async { indexedJournalIds.append(journalId) }
        func deleteEntry(journalId: String) async throws {}
        func transcribeJournal(journalId: String) async { transcribedJournalIds.append(journalId) }
        /// Scripted so tests can simulate a recovered transcript on the auto-retry path.
        var scriptedClipTranscript = ""
        private(set) var transcribeClipCalls = 0
        func transcribeClip(audio: Data, contentType: String) async throws -> String {
            transcribeClipCalls += 1
            return scriptedClipTranscript
        }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
            throw URLError(.cancelled)
        }
    }

    @MainActor
    private final class SpyProfileRepository: ProfileRepository {
        private(set) var recordedDeltas: [Int] = []
        func profile() -> AsyncStream<UserProfile?> { AsyncStream { $0.yield(nil) } }
        func update(_ profile: UserProfile) async throws {}
        func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws -> Bool { false }
        func mergeOnboardingDraft(_ draft: [String: String], overwriteExisting: Bool) async throws {}
        func addTotalWords(delta: Int) async throws { recordedDeltas.append(delta) }
        func reconcileDailyGoal(todayTotal: Int, now: Date) async throws {}
        func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {}
        func recordTimeSpent(minutes: Int) async throws {}
        func recordPromptAnswered() async throws {}
    }

    @MainActor
    private final class SpyMediaUploader: MediaUploader {
        struct UploadError: Error {}
        private(set) var uploads: [(kind: MediaKind, journalId: String)] = []
        private(set) var uploadCalls = 0
        var shouldFail = false
        var failingCalls: Set<Int> = []

        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
            let call = uploadCalls
            uploadCalls += 1
            if shouldFail || failingCalls.contains(call) { throw UploadError() }
            uploads.append((kind, journalId))
            return MediaItem(s3Key: "spy/\(kind.rawValue)/\(uploads.count)", kind: kind)
        }

        // NOTE: prepareUpload/presignUpload are the audio/video (journal) path.
        // The existing shouldFail/failingCalls knobs target the inline photo
        // `upload(...)` path (unchanged), so the image-based failure/retry tests
        // still exercise real failure behavior. We don't reconcile those knobs
        // with the manager path here — AV failure is covered by UploadManagerTests.
        func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload {
            let encryptedURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
            try? Data([0, 1, 2]).write(to: encryptedURL)
            uploads.append((kind, journalId))
            let s3Key = "spy/\(kind.rawValue)/\(uploads.count)"
            // durationSec is supplied by the processor from the attachment; carry a
            // placeholder so the MediaItem is well-formed.
            let item = MediaItem(s3Key: s3Key, kind: kind, durationSec: 0)
            return PreparedUpload(encryptedFileURL: encryptedURL, s3Key: s3Key, mediaItem: item)
        }

        private(set) var seededKeys: [String] = []
        func cacheLocalOriginal(_ fileURL: URL, for s3Key: String) async {
            seededKeys.append(s3Key)
        }

        func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int,
                           journalId: String) async throws -> (s3Key: String, url: URL) {
            (s3Key ?? "spy/key", URL(fileURLWithPath: "/dev/null"))
        }

        func viewURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/dev/null") }
        // A REAL readable temp file: `TranscriptRecoverer.recover` does
        // `Data(contentsOf:)` on this URL, which throws for `/dev/null` (so recover
        // would bail before ever transcribing). Back it with actual bytes so the
        // recover path is genuinely exercised.
        func localFileURL(for s3Key: String) async throws -> URL {
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("spy-clip-\(s3Key.replacingOccurrences(of: "/", with: "_"))")
            if !FileManager.default.fileExists(atPath: url.path) {
                try Data([0x00, 0x01, 0x02, 0x03]).write(to: url)
            }
            return url
        }
    }

    // MARK: - Fake transport (mirrors UploadManagerTests)

    private final class FakeTransport: UploadTransport {
        var statuses: [Int]
        private(set) var calls = 0
        init(_ s: [Int]) { statuses = s }
        func put(file: URL, to url: URL) async -> Int {
            defer { calls += 1 }
            return statuses[min(calls, statuses.count - 1)]
        }
    }

    /// Records every saved snapshot so tests can assert the status progression,
    /// while still answering `entries(after:)` like the live store.
    @MainActor
    private final class RecordingJournalRepository: JournalRepository {
        private(set) var store: [JournalEntry] = []
        /// processingStatus written on each save, in order.
        private(set) var statusHistory: [ProcessingStatus?] = []
        /// media[] written on each save, in order.
        private(set) var mediaHistory: [[MediaItem]] = []

        func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> { AsyncStream { $0.finish() } }
        func entries(after: Date?, limit: Int) async throws -> [JournalEntry] { store }
        func entriesToday(timezone: TimeZone) -> AsyncStream<[JournalEntry]> { AsyncStream { $0.finish() } }
        func fetchAllEntries() async throws -> [JournalEntry] { store }
        func entry(id: String) -> AsyncStream<JournalEntry?> { AsyncStream { $0.finish() } }

        func save(_ entry: JournalEntry) async throws {
            if let i = store.firstIndex(where: { $0.id == entry.id }) { store[i] = entry } else { store.append(entry) }
            statusHistory.append(entry.processingStatus)
            mediaHistory.append(entry.media)
        }
        func updateAIFields(id: String, summary: AIGeneration?, insights: AIGeneration?, prompts: AIPrompts?) async throws {}
        func updateCognitiveMap(id: String, map: CognitiveMapGeneration) async throws {}
        func updateContent(id: String, content: String, wordCount: Int, contentEditedAt: Date, appendedMedia: [MediaItem]) async throws {}
        func applyEntryEdit(id: String, title: String, content: String, wordCount: Int, contentEditedAt: Date?, edit: EditRecord) async throws {}
        func delete(id: String) async throws { store.removeAll { $0.id == id } }
        func setExcludeFromShare(entryId: String, value: Bool) async throws {}
        func countEntries(on date: Date, excluding draftId: String) async throws -> Int {
            let calendar = Calendar.current
            let start = calendar.startOfDay(for: date)
            guard let end = calendar.date(byAdding: .day, value: 1, to: start) else { return 0 }
            return store.filter { e in
                e.id != draftId && e.createdAt >= start && e.createdAt < end
            }.count
        }
    }

    // MARK: - Harness

    @MainActor
    private struct Harness {
        let processor: BackgroundEntryProcessor
        let journals: RecordingJournalRepository
        let profiles: SpyProfileRepository
        let ai: SpyAIService
        let media: SpyMediaUploader
        let ocr: MockOCRService
        let journal: UploadJournal
        let permanentFailures: PermanentFailureBox

        final class PermanentFailureBox { var draftIds: [String] = [] }

        init(transport: UploadTransport = FakeTransport([200])) {
            journals = RecordingJournalRepository()
            profiles = SpyProfileRepository()
            ai = SpyAIService()
            media = SpyMediaUploader()
            ocr = MockOCRService()

            let dir = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
            journal = UploadJournal(directory: dir)
            // Mirror live() wiring: the finalizer carries a recoverer so the ZK
            // auto-retry path is exercised. (No-op with aiModel1 == false, which
            // most tests in this suite pin.)
            let finalizer = EntryFinalizer(
                journals: journals, profiles: profiles, ai: ai,
                recoverer: TranscriptRecoverer(journals: journals, profiles: profiles, ai: ai, media: media))
            let failures = PermanentFailureBox()
            permanentFailures = failures
            let uploadManager = UploadManager(
                journal: journal,
                transport: transport,
                presign: { _ in URL(string: "https://signed/put")! },
                onFinalize: { pending in await finalizer.finalize(pending) },
                // Mirror live() wiring: a permanent upload failure flips the entry
                // to `.failed` (via the finalizer) as well as recording the draftId.
                onPermanentFailure: { [journal] draftId in
                    failures.draftIds.append(draftId)
                    guard let pending = journal.entry(draftId: draftId) else { return }
                    await finalizer.markFailed(pending)
                },
                maxAttempts: 5,
                backoff: { _ in 0 }
            )
            processor = BackgroundEntryProcessor(
                dependencies: BackgroundEntryProcessor.Dependencies(
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr,
                    transcoder: VideoTranscoder(), journal: journal,
                    uploadManager: uploadManager, finalizer: finalizer,
                    drafts: DraftStore(directory: dir.appendingPathComponent("drafts"))
                )
            )
        }

        func run(_ job: EntryProcessingJob) async {
            processor.enqueue(job)
            await processor.task(for: job.draftId)?.value
        }

        func savedEntry() throws -> JournalEntry { try XCTUnwrap(journals.store.first) }
    }

    // MARK: - Job builders

    @MainActor
    private func textJob(text: String, promptText: String? = nil) -> EntryProcessingJob {
        EntryProcessingJob(
            draftId: UUID().uuidString, userId: "user-1", promptText: promptText,
            attachments: AttachmentSet(), text: text, createdAt: Date()
        )
    }

    @MainActor
    private func imageJob(photos: [PhotoAttachment], text: String = "") -> EntryProcessingJob {
        var set = AttachmentSet()
        set.addPhotos(photos)
        return EntryProcessingJob(
            draftId: UUID().uuidString, userId: "user-1", promptText: nil,
            attachments: set, text: text, createdAt: Date()
        )
    }

    @MainActor
    private func voiceJob(durationSec: Double) -> EntryProcessingJob {
        var set = AttachmentSet()
        set.setAudio(AudioAttachment(
            url: FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).m4a"),
            durationSec: durationSec
        ))
        return EntryProcessingJob(
            draftId: UUID().uuidString, userId: "user-1", promptText: nil,
            attachments: set, text: "", createdAt: Date()
        )
    }

    @MainActor
    private func videoJob(durationSec: Double) -> EntryProcessingJob {
        var set = AttachmentSet()
        set.setVideo(VideoAttachment(
            url: FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4"),
            durationSec: durationSec
        ))
        return EntryProcessingJob(
            draftId: UUID().uuidString, userId: "user-1", promptText: nil,
            attachments: set, text: "", createdAt: Date()
        )
    }

    // MARK: - Text

    @MainActor
    func testTextEntryWritesImmediatelyAndIndexes() async throws {
        let harness = Harness()
        await harness.run(textJob(text: "Walked the long way home.\nIt helped."))

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.type, .text)
        XCTAssertEqual(entry.content, "Walked the long way home.\nIt helped.")
        XCTAssertEqual(entry.wordCount, 7)
        XCTAssertNil(entry.transcriptStatus)
        XCTAssertEqual(entry.processingStatus, .ready)
        XCTAssertTrue(entry.media.isEmpty)
        XCTAssertEqual(harness.profiles.recordedDeltas, [7])
        XCTAssertEqual(harness.ai.indexedJournalIds, [entry.id])
        XCTAssertTrue(harness.ai.transcribedJournalIds.isEmpty)
        XCTAssertEqual(harness.journals.statusHistory, [.ready], "Text settles in a single write")
    }

    @MainActor
    func testTitleUsesPromptThenDate() async throws {
        // A prompt becomes the title (first line only); content is unchanged.
        let h1 = Harness()
        await h1.run(textJob(text: "Making breakfast.", promptText: "What felt easy today?"))
        XCTAssertEqual(try h1.savedEntry().title, "What felt easy today?")
        XCTAssertEqual(try h1.savedEntry().content, "Making breakfast.")

        // Multi-line prompt → only the first line is used.
        let h2 = Harness()
        await h2.run(textJob(text: "Some thoughts.", promptText: "Line one\nLine two"))
        XCTAssertEqual(try h2.savedEntry().title, "Line one")

        // No prompt → date-based title (long format, no time).
        let h3 = Harness()
        let expectedDate = Date().formatted(date: .long, time: .omitted)
        await h3.run(textJob(text: "\n\nFirst line\nSecond line"))
        XCTAssertEqual(try h3.savedEntry().title, expectedDate)

        // Second entry on the same day → title gets a " 2" suffix.
        let h4 = Harness()
        let now = Date()
        let existing = JournalEntry(
            id: "prior-entry", userId: "user-1", type: .text,
            title: now.formatted(date: .long, time: .omitted),
            createdAt: now, updatedAt: now, content: "Earlier entry", wordCount: 2
        )
        try await h4.journals.save(existing)
        await h4.run(textJob(text: "Second entry today"))
        let newEntry = try XCTUnwrap(h4.journals.store.first { $0.id != "prior-entry" })
        XCTAssertEqual(newEntry.title, "\(now.formatted(date: .long, time: .omitted)) 2")
    }

    // MARK: - Image (OCR)

    @MainActor
    func testImageEntryRunsOCRUploadsAndSettlesReady() async throws {
        let harness = Harness()
        harness.ocr.scriptedTexts = ["First page text.", "Second page text."]
        await harness.run(imageJob(photos: [
            PhotoAttachment(imageData: Data([0x01])),
            PhotoAttachment(imageData: Data([0x02])),
        ]))

        let entry = try harness.savedEntry()
        XCTAssertEqual(harness.ocr.recognizeCalls, 2)
        XCTAssertEqual(entry.type, .image)
        XCTAssertEqual(entry.content, "First page text.\n\nSecond page text.")
        XCTAssertEqual(entry.transcriptStatus, .ready)
        XCTAssertEqual(entry.processingStatus, .ready)
        XCTAssertEqual(entry.media.map(\.kind), [.image, .image])
        XCTAssertEqual(harness.ai.indexedJournalIds, [entry.id])
        XCTAssertTrue(harness.ai.transcribedJournalIds.isEmpty)
    }

    @MainActor
    func testImageEntryPrependsTypedText() async throws {
        let harness = Harness()
        harness.ocr.scriptedTexts = ["Recipe card."]
        await harness.run(imageJob(photos: [PhotoAttachment(imageData: Data([0x01]))], text: "Grandma's recipe box."))

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.content, "Grandma's recipe box.\n\nRecipe card.")
    }

    // MARK: - Voice / video → server transcription

    @MainActor
    func testVoiceEntryUploadsAndHandsOffToTranscription() async throws {
        let harness = Harness()
        await harness.run(voiceJob(durationSec: 12))

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.type, .voice)
        XCTAssertEqual(entry.content, "")
        XCTAssertEqual(entry.transcriptStatus, .processing)
        XCTAssertEqual(entry.processingStatus, .transcribing)
        XCTAssertEqual(entry.media.map(\.kind), [.audio])
        XCTAssertEqual(entry.media.first?.durationSec, 12)
        XCTAssertEqual(harness.ai.transcribedJournalIds, [entry.id])
        XCTAssertTrue(harness.ai.indexedJournalIds.isEmpty, "Server transcription re-indexes; no separate index call")
        XCTAssertEqual(harness.profiles.recordedDeltas.count, 1)
    }

    @MainActor
    func testVoiceEntryPopulatesMediaAtUploadingSaveAndSeedsCache() async throws {
        let harness = Harness()
        let job = voiceJob(durationSec: 720)  // 12 minutes
        await harness.run(job)

        // The audio MediaItem is present on the persisted entry...
        let entry = try harness.savedEntry()
        let audio = try XCTUnwrap(entry.media.first(where: { $0.kind == .audio }))
        XCTAssertEqual(audio.durationSec, 720)

        // ...and the plaintext original was seeded under that same key, so the
        // player card resolves locally without waiting for the upload.
        XCTAssertTrue(harness.media.seededKeys.contains(audio.s3Key),
                      "expected the audio clip to be seeded into the display cache")

        // Media is written at the `.uploading` stage, not only at finalize: the
        // FIRST save that carries a non-empty `media` happens while status is
        // `.uploading` (before `.saving`/`.transcribing`).
        let firstMediaIndex = harness.journals.mediaHistory.firstIndex { !$0.isEmpty }
        let uploadingIndex = harness.journals.statusHistory.firstIndex(of: .uploading)
        XCTAssertNotNil(firstMediaIndex)
        XCTAssertEqual(firstMediaIndex, uploadingIndex,
                       "media should first appear on the .uploading save")
    }

    // MARK: - Status progression

    @MainActor
    func testVoiceStatusProgression() async throws {
        let harness = Harness()
        await harness.run(voiceJob(durationSec: 5))
        XCTAssertEqual(
            harness.journals.statusHistory,
            [.processing, .uploading, .saving, .transcribing],
            "Entry surfaces each phase before handing off to the server"
        )
    }

    @MainActor
    func testImageStatusProgression() async throws {
        let harness = Harness()
        harness.ocr.scriptedTexts = ["Page."]
        await harness.run(imageJob(photos: [PhotoAttachment(imageData: Data([0x01]))]))
        XCTAssertEqual(harness.journals.statusHistory, [.processing, .uploading, .saving, .ready])
    }

    // MARK: - Failure + retry

    @MainActor
    func testUploadFailureMarksFailedAndRetainsJob() async throws {
        let harness = Harness()
        harness.media.shouldFail = true
        let job = imageJob(photos: [PhotoAttachment(imageData: Data([0x01]))])
        await harness.run(job)

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.processingStatus, .failed)
        XCTAssertTrue(harness.profiles.recordedDeltas.isEmpty)
        XCTAssertTrue(harness.ai.transcribedJournalIds.isEmpty)
        XCTAssertTrue(harness.ai.indexedJournalIds.isEmpty)
        XCTAssertTrue(harness.processor.hasPendingJob(draftId: job.draftId), "Failed job retained for retry")
    }

    @MainActor
    func testRetryAfterFailureReusesDraftAndOnlyReuploadsFailedItems() async throws {
        let harness = Harness()
        harness.ocr.scriptedTexts = ["Page one.", "Page two."]
        harness.media.failingCalls = [1] // first photo uploads, second fails
        let job = imageJob(photos: [
            PhotoAttachment(imageData: Data([0x01])),
            PhotoAttachment(imageData: Data([0x02])),
        ])
        await harness.run(job)
        XCTAssertEqual(try harness.savedEntry().processingStatus, .failed)
        XCTAssertEqual(harness.media.uploadCalls, 2)
        XCTAssertEqual(harness.ocr.recognizeCalls, 2)

        harness.media.failingCalls = []
        harness.processor.retry(draftId: job.draftId)
        await harness.processor.task(for: job.draftId)?.value

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.processingStatus, .ready)
        XCTAssertEqual(entry.media.count, 2)
        XCTAssertEqual(entry.content, "Page one.\n\nPage two.")
        XCTAssertEqual(harness.media.uploadCalls, 3, "Only the failed photo is re-uploaded")
        XCTAssertEqual(harness.ocr.recognizeCalls, 2, "OCR is cached across retries")
    }

    /// A voice/video entry whose UPLOAD permanently fails (attempt cap hit) must
    /// flip to `.failed` — not stay stuck at "Uploading…". Exercises the live
    /// `onPermanentFailure → finalizer.markFailed` wiring through UploadManager.
    @MainActor
    func testAudioVisualPermanentUploadFailureMarksEntryFailed() async throws {
        // Transport always returns 500 → every upload attempt fails → cap hit.
        let harness = Harness(transport: FakeTransport([500]))
        let job = voiceJob(durationSec: 5)
        await harness.run(job)

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.processingStatus, .failed,
                       "Permanent upload failure must surface as .failed (with a Retry button)")
        XCTAssertEqual(harness.permanentFailures.draftIds, [job.draftId],
                       "onPermanentFailure fired for the draft")
        XCTAssertTrue(harness.ai.transcribedJournalIds.isEmpty, "finalize must NOT run on a failed upload")
    }

    /// Zero-knowledge auto-recovery: when the pre-upload on-device transcription
    /// fails (here the staged audio temp file is absent, so `deriveContent` yields
    /// a `.failed`/empty transcript), the finalizer must re-transcribe from the
    /// now-uploaded S3 audio and settle the entry `.ready` — with no user action.
    @MainActor
    func testZKFailedTranscriptAutoRecoversFromS3AfterUpload() async throws {
        DevFlags.aiModel1 = true // ZK path (restored by tearDown)
        let harness = Harness(transport: FakeTransport([200])) // uploads succeed
        harness.ai.scriptedClipTranscript = "recovered transcript"

        await harness.run(voiceJob(durationSec: 5))

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.transcriptStatus, .ready, "auto-recovery settles the transcript")
        XCTAssertEqual(entry.content, "recovered transcript")
        XCTAssertEqual(entry.processingStatus, .ready)
        XCTAssertGreaterThan(harness.ai.transcribeClipCalls, 0, "recover() re-transcribed from S3")
    }

    /// A re-transcription that comes back degenerate (a word or two for a
    /// multi-minute clip — the "one character" incidents) must NOT be saved as a
    /// successful `.ready` transcript. The entry stays `.failed` so the Retry
    /// affordance and future recovery remain available.
    @MainActor
    func testZKDegenerateReTranscriptionStaysFailedNotReady() async throws {
        DevFlags.aiModel1 = true // ZK path (restored by tearDown)
        let harness = Harness(transport: FakeTransport([200])) // uploads succeed
        // Staged temp file is absent → inline derive yields empty/`.failed`, so the
        // finalizer recovers from S3 — where the provider returns a lone word for a
        // 200 s recording.
        harness.ai.scriptedClipTranscript = "So"

        await harness.run(voiceJob(durationSec: 200))

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.transcriptStatus, .failed,
                       "a 1-word transcript for a 200 s clip is not a success")
        XCTAssertNotEqual(entry.content, "So", "degenerate result must not overwrite as ready content")
        XCTAssertGreaterThan(harness.ai.transcribeClipCalls, 0, "recover() was attempted")
    }

    /// The inline (pre-upload) ZK transcription path: when the provider returns a
    /// degenerate result for a long recording, the entry must settle `.failed`,
    /// not `.ready` — even though the transcript is non-empty.
    @MainActor
    func testZKInlineDegenerateTranscriptionMarksFailed() async throws {
        DevFlags.aiModel1 = true // ZK path (restored by tearDown)
        let harness = Harness(transport: FakeTransport([200]))
        harness.ai.scriptedClipTranscript = "So" // 1 word for a 200 s clip

        // Real on-disk audio so the inline transcription actually runs.
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).m4a")
        try Data([0x00, 0x01, 0x02, 0x03]).write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        var set = AttachmentSet()
        _ = set.setAudio(AudioAttachment(url: url, durationSec: 200))
        let job = EntryProcessingJob(
            draftId: UUID().uuidString, userId: "user-1", promptText: nil,
            attachments: set, text: "", createdAt: Date())

        await harness.run(job)

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.transcriptStatus, .failed,
                       "degenerate inline transcript must not settle as ready")
    }

    // MARK: - Stuck-entry sweep

    /// A voice entry stranded at `.processing` with no in-flight job and no
    /// durable upload record (the app-killed-mid-transcription case) must be
    /// swept to `.failed` so it stops showing "Processing…" forever.
    @MainActor
    func testSweepMarksStrandedProcessingEntryFailed() async throws {
        let harness = Harness()
        let stranded = JournalEntry(
            id: "stuck-1", userId: "user-1", type: .voice, title: "t",
            createdAt: Date(timeIntervalSinceNow: -3600),
            updatedAt: Date(timeIntervalSinceNow: -3600),
            content: "", transcriptStatus: .processing, processingStatus: .processing)
        try await harness.journals.save(stranded)

        await harness.processor.sweepStuckEntries(staleAfter: 120, now: Date())

        let entry = try XCTUnwrap(harness.journals.store.first { $0.id == "stuck-1" })
        XCTAssertEqual(entry.processingStatus, .failed)
    }

    /// The sweep must NOT touch a just-created entry (younger than the staleness
    /// window) — its pipeline may simply not have reached durability yet.
    @MainActor
    func testSweepLeavesFreshNonTerminalEntryAlone() async throws {
        let harness = Harness()
        let fresh = JournalEntry(
            id: "fresh-1", userId: "user-1", type: .voice, title: "t",
            createdAt: Date(), updatedAt: Date(),
            content: "", transcriptStatus: .processing, processingStatus: .processing)
        try await harness.journals.save(fresh)

        await harness.processor.sweepStuckEntries(staleAfter: 120, now: Date())

        let entry = try XCTUnwrap(harness.journals.store.first { $0.id == "fresh-1" })
        XCTAssertEqual(entry.processingStatus, .processing, "Fresh entries are left for the pipeline")
    }

    /// The sweep must NOT touch an entry that still has a durable upload record —
    /// `resumePendingJobs()` will drive it. (Old timestamp, but recoverable.)
    @MainActor
    func testSweepSkipsEntryWithDurableRecord() async throws {
        let harness = Harness()
        let draftId = "durable-1"
        let strandedButRecoverable = JournalEntry(
            id: draftId, userId: "user-1", type: .voice, title: "t",
            createdAt: Date(timeIntervalSinceNow: -3600),
            updatedAt: Date(timeIntervalSinceNow: -3600),
            content: "", transcriptStatus: .processing, processingStatus: .uploading)
        try await harness.journals.save(strandedButRecoverable)
        // Seed a durable upload record for the same draft.
        let ciphertext = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try Data([0, 1, 2]).write(to: ciphertext)
        try harness.journal.upsert(PendingEntry(
            draftId: draftId, userId: "user-1", type: .voice, title: "t",
            content: "", wordCount: 0, transcriptStatus: .processing,
            createdAtEpoch: Date().timeIntervalSince1970, promptText: nil,
            uploads: [PendingUpload(
                attachmentId: UUID(), kind: .audio, journalId: draftId,
                s3Key: "k", encryptedPath: ciphertext.path,
                durationSec: 5, width: nil, height: nil, thumbnailS3Key: nil, state: .pending)]))

        await harness.processor.sweepStuckEntries(staleAfter: 120, now: Date())

        let entry = try XCTUnwrap(harness.journals.store.first { $0.id == draftId })
        XCTAssertEqual(entry.processingStatus, .uploading, "Recoverable entries are left for resume")
    }

    @MainActor
    func testSuccessCleansUpStagedTempFiles() async throws {
        let harness = Harness()
        harness.ocr.scriptedTexts = ["x"]
        let photo = PhotoAttachment(imageData: Data([0x01]))
        await harness.run(imageJob(photos: [photo]))

        let photoTempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(photo.id.uuidString).jpg")
        XCTAssertFalse(FileManager.default.fileExists(atPath: photoTempURL.path))
        XCTAssertFalse(harness.processor.hasPendingJob(draftId: try harness.savedEntry().id))
    }

    // MARK: - Video (journal → manager → finalize)

    @MainActor
    func testVideoEntryUploadsViaJournalAndFinalizes() async throws {
        let harness = Harness()
        await harness.run(videoJob(durationSec: 8))

        let entry = try harness.savedEntry()
        XCTAssertEqual(entry.type, .video)
        XCTAssertEqual(entry.processingStatus, .transcribing)
        XCTAssertEqual(entry.media.map(\.kind), [.video])
        XCTAssertEqual(harness.ai.transcribedJournalIds, [entry.id])
        XCTAssertTrue(harness.ai.indexedJournalIds.isEmpty)
        // Journal record removed after a successful finalize.
        XCTAssertTrue(harness.journal.allPending().isEmpty)
    }

    // MARK: - Resume (post-relaunch finalization)

    @MainActor
    func testResumeFinalizesAnUploadedButUnfinalizedEntry() async throws {
        let harness = Harness()
        let draftId = UUID().uuidString
        let pending = PendingEntry(
            draftId: draftId, userId: "user-1", type: .voice, title: "t",
            content: "", wordCount: 0, transcriptStatus: .processing,
            createdAtEpoch: Date().timeIntervalSince1970, promptText: nil,
            uploads: [PendingUpload(
                attachmentId: UUID(), kind: .audio, journalId: draftId,
                s3Key: "spy/audio/seed", encryptedPath: "/dev/null",
                durationSec: 3, width: nil, height: nil, thumbnailS3Key: nil,
                state: .uploaded)]
        )
        try harness.journal.upsert(pending)

        await harness.processor.resumePendingJobs()

        // Finalize ran (AV entry → transcription triggered once) and the journal
        // record was removed.
        XCTAssertEqual(harness.ai.transcribedJournalIds.count, 1)
        XCTAssertEqual(harness.ai.transcribedJournalIds, [draftId])
        XCTAssertTrue(harness.journal.allPending().isEmpty)
    }

    /// FIX 1: resume must SKIP a draft that's still tracked in-session, so the
    /// same entry isn't finalized twice (which would double-count user stats via
    /// the unconditional `recordEntrySaved` increment).
    ///
    /// We get an in-session tracked job by enqueuing an image job that FAILS to
    /// upload — the processor retains failed jobs in `jobs` (so `hasPendingJob`
    /// is true). We then seed the durable journal with an `.uploaded` AV record
    /// under the SAME draftId. Without FIX 1, resume would finalize it (transcribe
    /// + remove the record). With FIX 1, resume skips it: no transcribe, record
    /// retained.
    @MainActor
    func testResumeSkipsDraftWithInFlightJob() async throws {
        let harness = Harness()
        harness.media.shouldFail = true
        let job = imageJob(photos: [PhotoAttachment(imageData: Data([0x01]))])
        await harness.run(job)
        XCTAssertTrue(harness.processor.hasPendingJob(draftId: job.draftId),
                      "Failed image job is retained in-session")

        // Seed a durable, fully-uploaded AV record under the SAME draftId.
        let pending = PendingEntry(
            draftId: job.draftId, userId: "user-1", type: .voice, title: "t",
            content: "", wordCount: 0, transcriptStatus: .processing,
            createdAtEpoch: Date().timeIntervalSince1970, promptText: nil,
            uploads: [PendingUpload(
                attachmentId: UUID(), kind: .audio, journalId: job.draftId,
                s3Key: "spy/audio/seed", encryptedPath: "/dev/null",
                durationSec: 3, width: nil, height: nil, thumbnailS3Key: nil,
                state: .uploaded)]
        )
        try harness.journal.upsert(pending)

        await harness.processor.resumePendingJobs()

        // Resume skipped the in-session draft: no finalize ran for it.
        XCTAssertTrue(harness.ai.transcribedJournalIds.isEmpty,
                      "Resume must not finalize a draft tracked in-session")
        XCTAssertEqual(harness.journal.entry(draftId: job.draftId)?.draftId, job.draftId,
                       "Resume must NOT remove the in-session draft's journal record")
    }

    /// FIX 2: on resume, if a not-yet-uploaded upload's ciphertext temp file was
    /// purged by iOS, fail fast (mark `.failed`, drop the durable record) instead
    /// of burning `maxAttempts` PUTs of a missing file. We assert the entry is
    /// saved `.failed`, the journal no longer lists it, and the transport saw 0
    /// calls (no upload attempts).
    @MainActor
    func testResumeFailsFastWhenCiphertextMissing() async throws {
        let transport = FakeTransport([200])
        let harness = Harness(transport: transport)
        let draftId = UUID().uuidString
        let missingPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).missing").path
        XCTAssertFalse(FileManager.default.fileExists(atPath: missingPath))

        let pending = PendingEntry(
            draftId: draftId, userId: "user-1", type: .voice, title: "t",
            content: "", wordCount: 0, transcriptStatus: .processing,
            createdAtEpoch: Date().timeIntervalSince1970, promptText: nil,
            uploads: [PendingUpload(
                attachmentId: UUID(), kind: .audio, journalId: draftId,
                s3Key: "spy/audio/seed", encryptedPath: missingPath,
                durationSec: 3, width: nil, height: nil, thumbnailS3Key: nil,
                state: .pending)] // NOT uploaded → must check ciphertext
        )
        try harness.journal.upsert(pending)

        await harness.processor.resumePendingJobs()

        let entry = try XCTUnwrap(harness.journals.store.first(where: { $0.id == draftId }))
        XCTAssertEqual(entry.processingStatus, .failed,
                       "Missing ciphertext on resume saves the entry as failed")
        XCTAssertTrue(harness.journal.allPending().allSatisfy { $0.draftId != draftId },
                      "Failed record is dropped so it isn't retried forever")
        XCTAssertEqual(transport.calls, 0,
                       "Fail-fast must not drive any upload attempts")
        XCTAssertTrue(harness.ai.transcribedJournalIds.isEmpty)
    }

    /// FIX A: on resume, an entry whose every not-yet-uploaded upload is still
    /// within its persisted `nextEarliestAttemptEpoch` backoff window must be
    /// SKIPPED this launch — not re-attempted with no inter-launch delay. The
    /// ciphertext file EXISTS (so it's not the fail-fast path); the gate is in the
    /// future. We assert the transport saw 0 calls and the journal record is
    /// RETAINED (not finalized) so a later launch past the gate picks it up.
    @MainActor
    func testResumeSkipsUploadStillInBackoffWindow() async throws {
        let transport = FakeTransport([200])
        let harness = Harness(transport: transport)
        let draftId = UUID().uuidString

        // Ciphertext EXISTS (not the missing-file fail-fast path).
        let existingPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).cipher").path
        try Data([0, 1, 2]).write(to: URL(fileURLWithPath: existingPath))
        XCTAssertTrue(FileManager.default.fileExists(atPath: existingPath))

        let pending = PendingEntry(
            draftId: draftId, userId: "user-1", type: .voice, title: "t",
            content: "", wordCount: 0, transcriptStatus: .processing,
            createdAtEpoch: Date().timeIntervalSince1970, promptText: nil,
            uploads: [PendingUpload(
                attachmentId: UUID(), kind: .audio, journalId: draftId,
                s3Key: "spy/audio/seed", encryptedPath: existingPath,
                durationSec: 3, width: nil, height: nil, thumbnailS3Key: nil,
                state: .pending, // NOT uploaded → eligible for the gate check
                nextEarliestAttemptEpoch: Date().timeIntervalSince1970 + 9999)] // far future
        )
        try harness.journal.upsert(pending)

        await harness.processor.resumePendingJobs()

        XCTAssertEqual(transport.calls, 0,
                       "Backoff-gated entry must not drive any upload attempts this launch")
        XCTAssertNotNil(harness.journal.entry(draftId: draftId),
                        "Gated entry's journal record is retained for a later launch")
        XCTAssertTrue(harness.ai.transcribedJournalIds.isEmpty,
                      "A skipped (not-finalized) entry must not transcribe")

        try? FileManager.default.removeItem(at: URL(fileURLWithPath: existingPath))
    }
}
