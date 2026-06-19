import XCTest
@testable import LuminaLog

/// The background pipeline that runs after the Create screen is dismissed:
/// writes a placeholder entry, derives content (OCR), uploads media, saves, and
/// hands voice/video off to server transcription — updating `processingStatus`
/// at each step and retaining failed jobs for in-session retry.
final class EntryProcessorTests: XCTestCase {

    // MARK: - Spies

    @MainActor
    private final class SpyAIService: AIService {
        private(set) var indexedJournalIds: [String] = []
        private(set) var transcribedJournalIds: [String] = []

        func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generateInsights(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> String { "" }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async { indexedJournalIds.append(journalId) }
        func deleteEntry(journalId: String) async throws {}
        func transcribeJournal(journalId: String) async { transcribedJournalIds.append(journalId) }
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
    }

    @MainActor
    private final class SpyProfileRepository: ProfileRepository {
        private(set) var recordedDeltas: [Int] = []
        func profile() -> AsyncStream<UserProfile?> { AsyncStream { $0.yield(nil) } }
        func update(_ profile: UserProfile) async throws {}
        func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws {}
        func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws { recordedDeltas.append(wordCountDelta) }
        func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {}
        func recordTimeSpent(minutes: Int) async throws {}
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
        func viewURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/dev/null") }
        func localFileURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/dev/null") }
    }

    /// Records every saved snapshot so tests can assert the status progression,
    /// while still answering `entries(after:)` like the live store.
    @MainActor
    private final class RecordingJournalRepository: JournalRepository {
        private(set) var store: [JournalEntry] = []
        /// processingStatus written on each save, in order.
        private(set) var statusHistory: [ProcessingStatus?] = []

        func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> { AsyncStream { $0.finish() } }
        func entries(after: Date?, limit: Int) async throws -> [JournalEntry] { store }
        func entry(id: String) -> AsyncStream<JournalEntry?> { AsyncStream { $0.finish() } }

        func save(_ entry: JournalEntry) async throws {
            if let i = store.firstIndex(where: { $0.id == entry.id }) { store[i] = entry } else { store.append(entry) }
            statusHistory.append(entry.processingStatus)
        }
        func updateAIFields(id: String, summary: AIGeneration?, insights: AIGeneration?, prompts: AIPrompts?) async throws {}
        func updateContent(id: String, content: String, wordCount: Int, contentEditedAt: Date, appendedMedia: [MediaItem]) async throws {}
        func applyEntryEdit(id: String, title: String, content: String, wordCount: Int, contentEditedAt: Date?, edit: EditRecord) async throws {}
        func delete(id: String) async throws { store.removeAll { $0.id == id } }
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

        init() {
            journals = RecordingJournalRepository()
            profiles = SpyProfileRepository()
            ai = SpyAIService()
            media = SpyMediaUploader()
            ocr = MockOCRService()
            processor = BackgroundEntryProcessor(
                dependencies: BackgroundEntryProcessor.Dependencies(
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr
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
    func testTitleUsesPromptThenFirstLine() async throws {
        // A prompt becomes the title; the content stays pure.
        let h1 = Harness()
        await h1.run(textJob(text: "Making breakfast.", promptText: "What felt easy today?"))
        XCTAssertEqual(try h1.savedEntry().title, "What felt easy today?")
        XCTAssertEqual(try h1.savedEntry().content, "Making breakfast.")

        // No prompt → first non-empty content line.
        let h2 = Harness()
        await h2.run(textJob(text: "\n\nFirst line\nSecond line"))
        XCTAssertEqual(try h2.savedEntry().title, "First line")
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
}
