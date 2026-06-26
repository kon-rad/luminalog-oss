import XCTest
@testable import LuminaLog

final class CreateEntryViewModelTests: XCTestCase {

    // MARK: - Spies

    /// Records the drafts handed off to the background processor.
    @MainActor
    private final class SpyEntryProcessor: EntryProcessor {
        private(set) var enqueued: [EntryProcessingJob] = []
        private(set) var retried: [String] = []
        func enqueue(_ job: EntryProcessingJob) { enqueued.append(job) }
        func retry(draftId: String) { retried.append(draftId) }
        func resumePendingJobs() async {}
    }

    // MARK: - Harness

    @MainActor
    private struct Harness {
        let viewModel: CreateEntryViewModel
        let processor: SpyEntryProcessor
        let speech: MockSpeechTranscriber

        init(promptText: String? = nil, signedIn: Bool = true) {
            processor = SpyEntryProcessor()
            speech = MockSpeechTranscriber()
            viewModel = CreateEntryViewModel(
                request: CreateEntryRequest(promptText: promptText),
                dependencies: CreateEntryDependencies(
                    auth: MockAuthService(signedIn: signedIn),
                    speech: speech,
                    entryProcessor: processor,
                    drafts: DraftStore(directory: FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString, isDirectory: true))
                )
            )
        }

        func enqueuedJob() throws -> EntryProcessingJob {
            try XCTUnwrap(processor.enqueued.first)
        }
    }

    @MainActor
    private func tempAudioURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).m4a")
    }

    // MARK: - Save hands off and dismisses

    @MainActor
    func testTextSaveEnqueuesJobAndDismissesImmediately() throws {
        let harness = Harness()
        harness.viewModel.text = "Walked the long way home."

        harness.viewModel.save()

        XCTAssertTrue(harness.viewModel.didSave, "View dismisses right away")
        let job = try harness.enqueuedJob()
        XCTAssertEqual(job.type, .text)
        XCTAssertEqual(job.text, "Walked the long way home.")
        XCTAssertEqual(job.userId, MockData.userId)
        XCTAssertNil(job.promptText)
    }

    @MainActor
    func testSaveDisabledWhenEmpty() {
        let harness = Harness()
        XCTAssertFalse(harness.viewModel.canSave)

        harness.viewModel.save()

        XCTAssertTrue(harness.processor.enqueued.isEmpty)
        XCTAssertFalse(harness.viewModel.didSave)
    }

    @MainActor
    func testImageSaveEnqueuesImageJobWithPhotos() throws {
        let harness = Harness()
        harness.viewModel.text = "Recipe box."
        harness.viewModel.addPhotos([
            PhotoAttachment(imageData: Data([0x01])),
            PhotoAttachment(imageData: Data([0x02])),
        ])

        harness.viewModel.save()

        let job = try harness.enqueuedJob()
        XCTAssertEqual(job.type, .image)
        XCTAssertEqual(job.attachments.photos.count, 2)
        XCTAssertEqual(job.text, "Recipe box.")
    }

    @MainActor
    func testVoiceSaveEnqueuesVoiceJobWithAudio() throws {
        let harness = Harness()
        harness.viewModel.attachAudio(AudioAttachment(url: tempAudioURL(), durationSec: 9))

        harness.viewModel.save()

        let job = try harness.enqueuedJob()
        XCTAssertEqual(job.type, .voice)
        XCTAssertNotNil(job.attachments.audio)
        XCTAssertEqual(job.attachments.audio?.durationSec, 9)
    }

    @MainActor
    func testSaveCarriesPromptText() throws {
        let harness = Harness(promptText: "What felt easy today?")
        harness.viewModel.text = "Making breakfast before everyone woke up."

        harness.viewModel.save()

        let job = try harness.enqueuedJob()
        XCTAssertEqual(job.promptText, "What felt easy today?")
        XCTAssertEqual(job.text, "Making breakfast before everyone woke up.")
    }

    @MainActor
    func testSaveDoesNotDeleteAttachmentBackingFiles() throws {
        // The processor takes ownership of temp files on save; the view model
        // must not delete them out from under it.
        let harness = Harness()
        let url = tempAudioURL()
        try Data([0x01]).write(to: url)
        harness.viewModel.attachAudio(AudioAttachment(url: url, durationSec: 3))

        harness.viewModel.save()

        XCTAssertTrue(harness.viewModel.didSave)
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.path),
            "Recording is handed to the processor, not deleted on save"
        )
        try? FileManager.default.removeItem(at: url)
    }

    @MainActor
    func testSaveWhenSignedOutDoesNothing() {
        let harness = Harness(signedIn: false)
        harness.viewModel.text = "A thought."

        harness.viewModel.save()

        XCTAssertTrue(harness.processor.enqueued.isEmpty)
        XCTAssertFalse(harness.viewModel.didSave)
    }

    // MARK: - Temp file lifecycle (cancel/discard)

    @MainActor
    func testRemoveAudioDeletesBackingFile() throws {
        let harness = Harness()
        let url = tempAudioURL()
        try Data([0x01]).write(to: url)
        harness.viewModel.attachAudio(AudioAttachment(url: url, durationSec: 3))

        harness.viewModel.removeAudio()

        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertTrue(harness.viewModel.attachments.isEmpty)
    }

    @MainActor
    func testCleanupTempFilesDeletesAttachmentBackingFiles() throws {
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

    // MARK: - Loading placeholders

    @MainActor
    func testBeginLoadingPhotosStagesPlaceholdersAndBlocksSave() {
        let harness = Harness()
        harness.viewModel.text = "Drafting."
        XCTAssertTrue(harness.viewModel.canSave)

        let ids = harness.viewModel.beginLoadingPhotos(count: 3)

        XCTAssertEqual(ids.count, 3)
        XCTAssertEqual(harness.viewModel.loadingPhotoIDs, ids)
        XCTAssertTrue(harness.viewModel.isLoadingMedia)
        XCTAssertTrue(harness.viewModel.hasVisibleAttachments)
        XCTAssertFalse(harness.viewModel.canSave, "Save blocked while photos load")
    }

    @MainActor
    func testResolveLoadingPhotoAddsPhotoAndClearsPlaceholder() {
        let harness = Harness()
        let ids = harness.viewModel.beginLoadingPhotos(count: 2)

        harness.viewModel.resolveLoadingPhoto(id: ids[0], photo: PhotoAttachment(imageData: Data([0x01])))

        XCTAssertEqual(harness.viewModel.loadingPhotoIDs, [ids[1]])
        XCTAssertEqual(harness.viewModel.attachments.photos.count, 1)
        XCTAssertTrue(harness.viewModel.isLoadingMedia, "Still one placeholder pending")

        harness.viewModel.resolveLoadingPhoto(id: ids[1], photo: PhotoAttachment(imageData: Data([0x02])))

        XCTAssertTrue(harness.viewModel.loadingPhotoIDs.isEmpty)
        XCTAssertEqual(harness.viewModel.attachments.photos.count, 2)
        XCTAssertFalse(harness.viewModel.isLoadingMedia)
        XCTAssertTrue(harness.viewModel.canSave, "Save re-enables once loads finish")
    }

    @MainActor
    func testDropLoadingPhotoClearsPlaceholderWithoutAdding() {
        let harness = Harness()
        let ids = harness.viewModel.beginLoadingPhotos(count: 2)

        harness.viewModel.dropLoadingPhoto(id: ids[0])

        XCTAssertEqual(harness.viewModel.loadingPhotoIDs, [ids[1]])
        XCTAssertTrue(harness.viewModel.attachments.photos.isEmpty, "Failed load adds no photo")
    }

    @MainActor
    func testLoadingVideoTogglesFlagAndBlocksSave() {
        let harness = Harness()
        harness.viewModel.text = "Clip incoming."

        harness.viewModel.beginLoadingVideo()
        XCTAssertTrue(harness.viewModel.isLoadingVideo)
        XCTAssertTrue(harness.viewModel.hasVisibleAttachments)
        XCTAssertFalse(harness.viewModel.canSave)

        harness.viewModel.endLoadingVideo()
        XCTAssertFalse(harness.viewModel.isLoadingVideo)
        XCTAssertTrue(harness.viewModel.canSave)
    }

    @MainActor
    func testBeginLoadingPhotosWithZeroCountIsNoOp() {
        let harness = Harness()
        let ids = harness.viewModel.beginLoadingPhotos(count: 0)

        XCTAssertTrue(ids.isEmpty)
        XCTAssertFalse(harness.viewModel.isLoadingMedia)
    }

    // MARK: - Type determination rules

    @MainActor
    func testEntryTypeRules() {
        var set = AttachmentSet()
        XCTAssertEqual(set.entryType, .text)

        set.setAudio(AudioAttachment(url: URL(fileURLWithPath: "/tmp/a.m4a"), durationSec: 3))
        XCTAssertEqual(set.entryType, .voice)

        let notice = set.addPhotos([PhotoAttachment(imageData: Data())])
        XCTAssertEqual(set.entryType, .image)
        XCTAssertNil(set.audio)
        XCTAssertNotNil(notice)

        XCTAssertFalse(set.canRecordAudio)
        let audioNotice = set.setAudio(
            AudioAttachment(url: URL(fileURLWithPath: "/tmp/b.m4a"), durationSec: 2)
        )
        XCTAssertNil(set.audio)
        XCTAssertNotNil(audioNotice)

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
