import XCTest
@testable import LuminaLog

final class CreateEntryViewModelTests: XCTestCase {

    // MARK: - Spies

    /// Records `requestIndex` calls; other AI features are unused here.
    @MainActor
    private final class SpyAIService: AIService {
        private(set) var indexedJournalIds: [String] = []

        func generateSummary(journalId: String) async throws -> AIGeneration {
            AIGeneration(text: "", model: "")
        }
        func generateInsights(journalId: String) async throws -> AIGeneration {
            AIGeneration(text: "", model: "")
        }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> String { "" }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        private(set) var transcribedJournalIds: [String] = []

        func requestIndex(journalId: String) async {
            indexedJournalIds.append(journalId)
        }
        func transcribeJournal(journalId: String) async {
            transcribedJournalIds.append(journalId)
        }
    }

    /// Records `recordEntrySaved` calls.
    @MainActor
    private final class SpyProfileRepository: ProfileRepository {
        private(set) var recordedDeltas: [Int] = []

        func profile() -> AsyncStream<UserProfile?> {
            AsyncStream { $0.yield(nil) }
        }
        func update(_ profile: UserProfile) async throws {}
        func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws {}
        func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws {
            recordedDeltas.append(wordCountDelta)
        }
    }

    /// Records uploads without touching the file system; can fail on demand.
    @MainActor
    private final class SpyMediaUploader: MediaUploader {
        struct UploadError: Error {}

        private(set) var uploads: [(kind: MediaKind, journalId: String)] = []
        /// Total `upload` calls, including failed ones.
        private(set) var uploadCalls = 0
        var shouldFail = false
        /// 0-based call indexes that throw (for partial-failure scenarios).
        var failingCalls: Set<Int> = []

        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
            let call = uploadCalls
            uploadCalls += 1
            if shouldFail || failingCalls.contains(call) { throw UploadError() }
            uploads.append((kind, journalId))
            return MediaItem(s3Key: "spy/\(kind.rawValue)/\(uploads.count)", kind: kind)
        }
        func viewURL(for s3Key: String) async throws -> URL {
            URL(fileURLWithPath: "/dev/null")
        }
    }

    /// Records `extractAudio` calls and returns a scripted URL.
    @MainActor
    private final class SpyAudioExtractor {
        private(set) var extractedFrom: [URL] = []
        var result: URL
        var error: Error?

        init(result: URL) {
            self.result = result
        }

        func extract(_ url: URL) async throws -> URL {
            extractedFrom.append(url)
            if let error { throw error }
            return result
        }
    }

    // MARK: - Harness

    @MainActor
    private struct Harness {
        let viewModel: CreateEntryViewModel
        let journals: MockJournalRepository
        let profiles: SpyProfileRepository
        let ai: SpyAIService
        let media: SpyMediaUploader
        let speech: MockSpeechTranscriber
        let ocr: MockOCRService
        let extractor: SpyAudioExtractor

        init(promptText: String? = nil) {
            journals = MockJournalRepository(entries: [])
            profiles = SpyProfileRepository()
            ai = SpyAIService()
            media = SpyMediaUploader()
            speech = MockSpeechTranscriber()
            ocr = MockOCRService()
            let extractor = SpyAudioExtractor(
                result: FileManager.default.temporaryDirectory
                    .appendingPathComponent("extracted-\(UUID().uuidString).m4a")
            )
            self.extractor = extractor
            viewModel = CreateEntryViewModel(
                request: CreateEntryRequest(promptText: promptText),
                dependencies: CreateEntryDependencies(
                    auth: MockAuthService(signedIn: true),
                    journals: journals,
                    profiles: profiles,
                    ai: ai,
                    media: media,
                    speech: speech,
                    ocr: ocr,
                    extractAudio: { try await extractor.extract($0) }
                )
            )
        }

        func savedEntry() async throws -> JournalEntry {
            let entries = try await journals.entries(after: nil, limit: 10)
            return try XCTUnwrap(entries.first)
        }
    }

    @MainActor
    private func tempAudioURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).m4a")
    }

    // MARK: - Text save

    @MainActor
    func testTextSaveBuildsEntryAndRunsPipeline() async throws {
        let harness = Harness()
        harness.viewModel.text = "Walked the long way home.\nIt helped."

        await harness.viewModel.save()
        await harness.viewModel.indexTask?.value

        let entry = try await harness.savedEntry()
        XCTAssertEqual(entry.type, .text)
        XCTAssertEqual(entry.content, "Walked the long way home.\nIt helped.")
        XCTAssertEqual(entry.wordCount, 7)
        XCTAssertEqual(entry.userId, MockData.userId)
        XCTAssertNil(entry.transcriptStatus, "Pure text entries have no transcript")
        XCTAssertTrue(entry.media.isEmpty)

        XCTAssertEqual(harness.profiles.recordedDeltas, [7], "Stats bumped with the word-count delta")
        XCTAssertEqual(harness.ai.indexedJournalIds, [entry.id], "RAG index requested for the new id")
        XCTAssertTrue(harness.viewModel.didSave)
    }

    @MainActor
    func testSaveDisabledWhenEmpty() async throws {
        let harness = Harness()
        XCTAssertFalse(harness.viewModel.canSave)

        await harness.viewModel.save()
        let entries = try await harness.journals.entries(after: nil, limit: 10)
        XCTAssertTrue(entries.isEmpty)
    }

    // MARK: - Image save (OCR)

    @MainActor
    func testImageSaveRunsOCRPerPhotoAndJoinsContent() async throws {
        let harness = Harness()
        harness.ocr.scriptedTexts = ["First page text.", "Second page text."]
        harness.viewModel.addPhotos([
            PhotoAttachment(imageData: Data([0x01])),
            PhotoAttachment(imageData: Data([0x02])),
        ])

        await harness.viewModel.save()

        let entry = try await harness.savedEntry()
        XCTAssertEqual(harness.ocr.recognizeCalls, 2, "OCR runs once per photo")
        XCTAssertEqual(entry.type, .image)
        XCTAssertEqual(entry.content, "First page text.\n\nSecond page text.")
        XCTAssertEqual(entry.transcriptStatus, .ready)
        XCTAssertEqual(entry.media.map(\.kind), [.image, .image])
    }

    @MainActor
    func testImageSavePrependsTypedText() async throws {
        let harness = Harness()
        harness.ocr.scriptedTexts = ["Recipe card."]
        harness.viewModel.text = "Grandma's recipe box."
        harness.viewModel.addPhotos([PhotoAttachment(imageData: Data([0x01]))])

        await harness.viewModel.save()

        let entry = try await harness.savedEntry()
        XCTAssertEqual(entry.type, .image, "Typed text plus photos is still an image entry")
        XCTAssertEqual(entry.content, "Grandma's recipe box.\n\nRecipe card.")
    }

    // MARK: - Voice save (server-side Whisper)

    @MainActor
    func testVoiceSaveSavesImmediatelyAndSchedulesWhisperTranscription() async throws {
        let harness = Harness()
        let url = tempAudioURL()
        harness.viewModel.attachAudio(AudioAttachment(url: url, durationSec: 12))

        await harness.viewModel.save()
        await harness.viewModel.indexTask?.value

        let entry = try await harness.savedEntry()
        XCTAssertTrue(harness.speech.transcribedFileURLs.isEmpty, "Apple Speech not used for file transcription")
        XCTAssertEqual(entry.type, .voice)
        XCTAssertEqual(entry.content, "")
        XCTAssertEqual(entry.transcriptStatus, .processing, "Server Whisper transcribes after save")
        XCTAssertEqual(entry.media.map(\.kind), [.audio])
        XCTAssertEqual(entry.media.first?.durationSec, 12)
        XCTAssertEqual(harness.ai.transcribedJournalIds, [entry.id], "Server transcription triggered")
    }

    @MainActor
    func testVoiceSaveWithTypedTextSavesImmediately() async throws {
        let harness = Harness()
        harness.viewModel.text = "Notes I typed before recording."
        harness.viewModel.attachAudio(AudioAttachment(url: tempAudioURL(), durationSec: 5))

        await harness.viewModel.save()

        let entry = try await harness.savedEntry()
        XCTAssertEqual(entry.type, .voice)
        XCTAssertEqual(entry.transcriptStatus, .processing, "Entry saves immediately; server Whisper transcribes after")
        XCTAssertEqual(entry.content, "Notes I typed before recording.", "Typed text is preserved immediately")
        XCTAssertEqual(entry.media.map(\.kind), [.audio])
    }

    // MARK: - Video save (server-side Whisper)

    @MainActor
    func testVideoSaveUploadsAndSchedulesWhisperTranscription() async throws {
        let harness = Harness()
        let videoURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).mov")
        harness.viewModel.attachVideo(VideoAttachment(url: videoURL, durationSec: 31))

        await harness.viewModel.save()
        await harness.viewModel.indexTask?.value

        let entry = try await harness.savedEntry()
        XCTAssertTrue(harness.extractor.extractedFrom.isEmpty, "No local audio extraction needed for server transcription")
        XCTAssertTrue(harness.speech.transcribedFileURLs.isEmpty, "Apple Speech not used for video entries")
        XCTAssertEqual(entry.type, .video)
        XCTAssertEqual(entry.transcriptStatus, .processing)
        XCTAssertEqual(entry.media.map(\.kind), [.video])
        XCTAssertEqual(entry.media.first?.durationSec, 31)
        XCTAssertEqual(harness.ai.transcribedJournalIds, [entry.id], "Server transcription triggered")
    }

    // MARK: - Temp file lifecycle

    @MainActor
    func testRemoveAudioDeletesBackingFile() async throws {
        let harness = Harness()
        let url = tempAudioURL()
        try Data([0x01]).write(to: url)
        harness.viewModel.attachAudio(AudioAttachment(url: url, durationSec: 3))

        harness.viewModel.removeAudio()

        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertTrue(harness.viewModel.attachments.isEmpty)
    }

    @MainActor
    func testSaveSuccessCleansUpStagedTempFiles() async throws {
        let harness = Harness()
        let photo = PhotoAttachment(imageData: Data([0x01]))
        harness.viewModel.addPhotos([photo])

        await harness.viewModel.save()

        XCTAssertTrue(harness.viewModel.didSave)
        let photoTempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(photo.id.uuidString).jpg")
        XCTAssertFalse(
            FileManager.default.fileExists(atPath: photoTempURL.path),
            "The photo's temporary upload file is deleted after a successful save"
        )
    }

    @MainActor
    func testCleanupTempFilesDeletesAttachmentBackingFiles() async throws {
        let harness = Harness()
        let url = tempAudioURL()
        try Data([0x01]).write(to: url)
        harness.viewModel.attachAudio(AudioAttachment(url: url, durationSec: 4))

        harness.viewModel.cleanupTempFiles()

        XCTAssertFalse(
            FileManager.default.fileExists(atPath: url.path),
            "Discarding the draft deletes the recording's backing file"
        )
    }

    // MARK: - Upload failure

    @MainActor
    func testUploadFailureBlocksSaveAndSurfacesRetryableError() async throws {
        let harness = Harness()
        harness.media.shouldFail = true
        harness.viewModel.addPhotos([PhotoAttachment(imageData: Data([0x01]))])

        await harness.viewModel.save()

        let entries = try await harness.journals.entries(after: nil, limit: 10)
        XCTAssertTrue(entries.isEmpty, "Entry is not saved until uploads succeed")
        XCTAssertNotNil(harness.viewModel.saveError)
        XCTAssertFalse(harness.viewModel.didSave)
        XCTAssertTrue(harness.profiles.recordedDeltas.isEmpty)

        // Retry after the uploader recovers reuses the same draft id.
        harness.media.shouldFail = false
        await harness.viewModel.save()
        let entry = try await harness.savedEntry()
        XCTAssertTrue(harness.viewModel.didSave)
        XCTAssertEqual(harness.media.uploads.first?.journalId, entry.id)
    }

    @MainActor
    func testRetryOnlyReuploadsFailedItemsAndSkipsRederivation() async throws {
        let harness = Harness()
        harness.ocr.scriptedTexts = ["Page one.", "Page two."]
        harness.viewModel.addPhotos([
            PhotoAttachment(imageData: Data([0x01])),
            PhotoAttachment(imageData: Data([0x02])),
        ])
        harness.media.failingCalls = [1] // first photo uploads, second fails

        await harness.viewModel.save()
        XCTAssertNotNil(harness.viewModel.saveError)
        XCTAssertEqual(harness.media.uploadCalls, 2)
        XCTAssertEqual(harness.ocr.recognizeCalls, 2)

        await harness.viewModel.save()

        let entry = try await harness.savedEntry()
        XCTAssertTrue(harness.viewModel.didSave)
        XCTAssertEqual(
            harness.media.uploadCalls, 3,
            "Retry re-uploads only the photo that failed; the cached upload is reused"
        )
        XCTAssertEqual(entry.media.count, 2)
        XCTAssertEqual(entry.content, "Page one.\n\nPage two.")
        XCTAssertEqual(
            harness.ocr.recognizeCalls, 2,
            "Derived content is cached across retries — OCR doesn't run again"
        )
    }

    // MARK: - Type determination rules

    @MainActor
    func testEntryTypeRules() {
        var set = AttachmentSet()
        XCTAssertEqual(set.entryType, .text)

        set.setAudio(AudioAttachment(url: URL(fileURLWithPath: "/tmp/a.m4a"), durationSec: 3))
        XCTAssertEqual(set.entryType, .voice)

        // Photos win over audio: audio is dropped with a notice.
        let notice = set.addPhotos([PhotoAttachment(imageData: Data())])
        XCTAssertEqual(set.entryType, .image)
        XCTAssertNil(set.audio)
        XCTAssertNotNil(notice)

        // Recording is blocked while photos are attached.
        XCTAssertFalse(set.canRecordAudio)
        let audioNotice = set.setAudio(
            AudioAttachment(url: URL(fileURLWithPath: "/tmp/b.m4a"), durationSec: 2)
        )
        XCTAssertNil(set.audio)
        XCTAssertNotNil(audioNotice)

        // Video replaces everything (the view confirms first).
        XCTAssertTrue(set.videoNeedsReplacementConfirm)
        set.setVideo(VideoAttachment(url: URL(fileURLWithPath: "/tmp/v.mov")))
        XCTAssertEqual(set.entryType, .video)
        XCTAssertTrue(set.photos.isEmpty)
        XCTAssertNil(set.audio)

        set.removeVideo()
        XCTAssertEqual(set.entryType, .text)
    }

    @MainActor
    func testPhotoCapEnforced() {
        var set = AttachmentSet()
        let photos = (0..<12).map { _ in PhotoAttachment(imageData: Data()) }
        let notice = set.addPhotos(photos)
        XCTAssertEqual(set.photos.count, AttachmentSet.maxPhotos)
        XCTAssertNotNil(notice)
    }

    // MARK: - Title rule

    @MainActor
    func testTitleUsesPromptWhenPresent() async throws {
        let harness = Harness(promptText: "What felt easy today?")
        harness.viewModel.text = "Making breakfast before everyone woke up."

        await harness.viewModel.save()

        let entry = try await harness.savedEntry()
        XCTAssertEqual(entry.title, "What felt easy today?")
        XCTAssertEqual(
            entry.content,
            "Making breakfast before everyone woke up.",
            "The prompt lives in the title; content stays pure"
        )
    }

    @MainActor
    func testTitleFallsBackToFirstNonEmptyLineTruncated() async throws {
        let harness = Harness()
        let longLine = String(repeating: "alpha ", count: 30) // 180 chars
        harness.viewModel.text = "\n\n" + longLine + "\nsecond line"

        await harness.viewModel.save()

        let entry = try await harness.savedEntry()
        XCTAssertTrue(entry.title.hasSuffix("…"))
        XCTAssertLessThanOrEqual(entry.title.count, 80)
        XCTAssertTrue(entry.title.hasPrefix("alpha alpha"))
    }

    // MARK: - Dictation segment replacement

    @MainActor
    func testDictationPartialsReplaceSegmentNotDuplicate() async throws {
        let harness = Harness()
        harness.speech.scriptedPartials = ["Hello", "Hello world"]

        await harness.viewModel.startDictation()
        await harness.viewModel.dictationTask?.value

        XCTAssertEqual(harness.viewModel.text, "Hello world", "Cumulative partials replace the segment")
        XCTAssertEqual(harness.viewModel.dictationState, .idle, "State resets when the stream ends")
    }

    @MainActor
    func testDictationAppendsAfterExistingTextWithSeparator() async throws {
        let harness = Harness()
        harness.speech.scriptedPartials = ["And", "And then sunshine"]
        harness.viewModel.text = "Morning pages."

        await harness.viewModel.startDictation()
        await harness.viewModel.dictationTask?.value

        XCTAssertEqual(harness.viewModel.text, "Morning pages. And then sunshine")
    }

    @MainActor
    func testDictationDeniedShowsSettingsAlert() async {
        let harness = Harness()
        harness.speech.authorizationGranted = false

        await harness.viewModel.startDictation()

        XCTAssertTrue(harness.viewModel.showDictationDeniedAlert)
        XCTAssertEqual(harness.viewModel.dictationState, .idle)
        XCTAssertEqual(harness.speech.startLiveCalls, 0)
    }

    @MainActor
    func testStopDictationStopsTranscriberWhileListening() async {
        let harness = Harness()
        harness.speech.holdLiveStreamOpen = true
        harness.speech.scriptedPartials = ["Hello there"]

        await harness.viewModel.startDictation()
        XCTAssertEqual(harness.viewModel.dictationState, .listening)

        // Let the dictation task consume the buffered partial before stopping.
        for _ in 0..<1_000 where harness.viewModel.text.isEmpty {
            await Task.yield()
        }

        harness.viewModel.stopDictation()
        await harness.viewModel.dictationTask?.value

        XCTAssertEqual(harness.speech.stopLiveCalls, 1)
        XCTAssertEqual(harness.viewModel.dictationState, .idle)
        XCTAssertEqual(harness.viewModel.text, "Hello there", "Partials delivered before stop are kept")
    }
}
