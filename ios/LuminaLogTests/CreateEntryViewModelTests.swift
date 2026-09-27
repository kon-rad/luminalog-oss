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
        func sweepStuckEntries() async {}
    }

    // MARK: - Harness

    @MainActor
    private struct Harness {
        let viewModel: CreateEntryViewModel
        let processor: SpyEntryProcessor
        let speech: MockSpeechTranscriber
        let drafts: DraftStore

        init(promptText: String? = nil, signedIn: Bool = true) {
            processor = SpyEntryProcessor()
            speech = MockSpeechTranscriber()
            drafts = DraftStore(directory: FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true))
            viewModel = CreateEntryViewModel(
                request: CreateEntryRequest(promptText: promptText),
                dependencies: CreateEntryDependencies(
                    auth: MockAuthService(signedIn: signedIn),
                    speech: speech,
                    entryProcessor: processor,
                    drafts: drafts
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

    // MARK: - Instant recording chip

    /// Stopping a recording surfaces the audio chip IMMEDIATELY (from the known
    /// duration), keeps Save enabled while the merge runs, and swaps in the real
    /// clip — clearing the instant marker — once the merge lands.
    @MainActor
    func testInstantChipShowsOnStopAndClearsWhenClipAttaches() {
        let h = Harness()
        XCTAssertNil(h.viewModel.pendingRecordingDuration)
        XCTAssertFalse(h.viewModel.hasVisibleAttachments)

        h.viewModel.beginPendingRecording(durationSec: 42)
        XCTAssertEqual(h.viewModel.pendingRecordingDuration, 42)
        XCTAssertTrue(h.viewModel.hasVisibleAttachments, "instant chip must show before the merge")
        XCTAssertTrue(h.viewModel.canSave, "Save must stay enabled while the merge finalizes")

        let url = tempAudioURL()
        try? Data([0, 1, 2]).write(to: url)
        h.viewModel.attachAudio(AudioAttachment(url: url, durationSec: 42))
        XCTAssertNil(h.viewModel.pendingRecordingDuration, "attaching the clip clears the instant chip")
        XCTAssertEqual(h.viewModel.attachments.audios.count, 1)
    }

    /// A failed/cancelled merge clears the instant chip so nothing lingers.
    @MainActor
    func testClearPendingRecordingHidesChip() {
        let h = Harness()
        h.viewModel.beginPendingRecording(durationSec: 10)
        XCTAssertTrue(h.viewModel.hasVisibleAttachments)

        h.viewModel.clearPendingRecording()
        XCTAssertNil(h.viewModel.pendingRecordingDuration)
        XCTAssertFalse(h.viewModel.hasVisibleAttachments)
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
        XCTAssertEqual(job.attachments.audios.count, 1)
        XCTAssertEqual(job.attachments.audios.first?.durationSec, 9)
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
        let audio = AudioAttachment(url: url, durationSec: 3)
        harness.viewModel.attachAudio(audio)

        harness.viewModel.removeAudio(id: audio.id)

        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertTrue(harness.viewModel.attachments.isEmpty)
    }

    // MARK: - Multiple recordings

    /// Recording again appends: earlier recordings are never replaced.
    @MainActor
    func testSecondRecordingIsAddedNextToTheFirst() throws {
        let harness = Harness()
        var clips: [AudioAttachment] = []
        for seconds in [3.0, 5.0, 8.0, 13.0, 21.0] {
            let url = tempAudioURL()
            try Data([0x01]).write(to: url)
            let clip = AudioAttachment(url: url, durationSec: seconds)
            clips.append(clip)
            harness.viewModel.attachAudio(clip)
        }

        XCTAssertEqual(harness.viewModel.attachments.audios.map(\.id), clips.map(\.id),
                       "All five recordings are kept, in the order they were made")
        XCTAssertEqual(harness.viewModel.entryType, .voice)
        for clip in clips {
            XCTAssertTrue(FileManager.default.fileExists(atPath: clip.url.path),
                          "No earlier recording's file is deleted")
        }
        harness.viewModel.cleanupTempFiles()
    }

    /// Deleting one recording leaves the others (and their files) untouched.
    @MainActor
    func testRemovingOneRecordingKeepsTheOthers() throws {
        let harness = Harness()
        let firstURL = tempAudioURL(), secondURL = tempAudioURL()
        try Data([0x01]).write(to: firstURL)
        try Data([0x02]).write(to: secondURL)
        let first = AudioAttachment(url: firstURL, durationSec: 3)
        let second = AudioAttachment(url: secondURL, durationSec: 4)
        harness.viewModel.attachAudio(first)
        harness.viewModel.attachAudio(second)

        harness.viewModel.removeAudio(id: first.id)

        XCTAssertEqual(harness.viewModel.attachments.audios.map(\.id), [second.id])
        XCTAssertFalse(FileManager.default.fileExists(atPath: firstURL.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: secondURL.path))
        harness.viewModel.cleanupTempFiles()
    }

    /// Every recording is written to the durable draft so none is lost to a
    /// crash, a force quit, or closing the sheet.
    @MainActor
    func testEveryRecordingIsPersistedToTheDraft() throws {
        let harness = Harness()
        for seconds in [2.0, 6.0, 9.0] {
            let url = tempAudioURL()
            try Data([0x01]).write(to: url)
            harness.viewModel.attachAudio(AudioAttachment(url: url, durationSec: seconds))
        }

        let draft = try XCTUnwrap(harness.drafts.load(harness.viewModel.draftId))
        XCTAssertEqual(draft.attachments.filter { $0.kind == .audio }.map(\.durationSec), [2, 6, 9])
        harness.viewModel.cleanupTempFiles()
    }

    /// Photos can't silently push a recording out of the entry.
    @MainActor
    func testPhotosAreRefusedWhileRecordingsExist() throws {
        let harness = Harness()
        let url = tempAudioURL()
        try Data([0x01]).write(to: url)
        harness.viewModel.attachAudio(AudioAttachment(url: url, durationSec: 3))

        harness.viewModel.addPhotos([PhotoAttachment(imageData: Data([0x02]))])

        XCTAssertEqual(harness.viewModel.attachments.audios.count, 1, "The recording is kept")
        XCTAssertTrue(harness.viewModel.attachments.photos.isEmpty)
        XCTAssertEqual(harness.viewModel.attachmentNotice, AttachmentSet.visualMediaBlockedNotice)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        XCTAssertFalse(harness.viewModel.canAttachVisualMedia(recorderActive: false))
        harness.viewModel.cleanupTempFiles()
    }

    @MainActor
    func testVisualMediaBlockedWhileARecordingIsInFlight() {
        let harness = Harness()
        XCTAssertTrue(harness.viewModel.canAttachVisualMedia(recorderActive: false))
        XCTAssertFalse(harness.viewModel.canAttachVisualMedia(recorderActive: true))
        harness.viewModel.beginPendingRecording(durationSec: 4)
        XCTAssertFalse(harness.viewModel.canAttachVisualMedia(recorderActive: false),
                       "A recording still merging blocks photos/video too")
    }

    @MainActor
    func testRecordingCountCoversAttachedAndMergingClips() throws {
        let harness = Harness()
        XCTAssertEqual(harness.viewModel.recordingCount, 0)
        let url = tempAudioURL()
        try Data([0x01]).write(to: url)
        harness.viewModel.attachAudio(AudioAttachment(url: url, durationSec: 3))
        XCTAssertEqual(harness.viewModel.recordingCount, 1)
        harness.viewModel.beginPendingRecording(durationSec: 7)
        XCTAssertEqual(harness.viewModel.recordingCount, 2)
        harness.viewModel.cleanupTempFiles()
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

    // MARK: - Interruption save (calls / alarms / backgrounding)

    @MainActor
    func testAttachInterruptedAudioAttachesClipAndShowsSavedNotice() throws {
        let harness = Harness()
        let url = tempAudioURL()
        try Data([0x01]).write(to: url)

        harness.viewModel.attachInterruptedAudio(AudioAttachment(url: url, durationSec: 5))

        XCTAssertEqual(harness.viewModel.attachments.audios.first?.durationSec, 5,
                       "The partial recording is attached to the entry")
        XCTAssertEqual(harness.viewModel.attachmentNotice, "Recording saved to your entry.")
        try? FileManager.default.removeItem(at: url)
    }

    @MainActor
    func testAttachInterruptedAudioSupersededByPhotosKeepsPriorityNotice() throws {
        let harness = Harness()
        harness.viewModel.addPhotos([PhotoAttachment(imageData: Data([0x01]))])
        let url = tempAudioURL()
        try Data([0x02]).write(to: url)

        harness.viewModel.attachInterruptedAudio(AudioAttachment(url: url, durationSec: 5))

        XCTAssertTrue(harness.viewModel.attachments.audios.isEmpty, "Photos take priority; audio isn't kept")
        XCTAssertNotEqual(harness.viewModel.attachmentNotice, "Recording saved to your entry.",
                          "The saved-confirmation notice is not shown when the clip was dropped")
        XCTAssertNotNil(harness.viewModel.attachmentNotice,
                        "A priority notice explains why the audio wasn't kept")
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path),
                       "The superseded temp file is deleted")
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

        let first = AudioAttachment(url: URL(fileURLWithPath: "/tmp/a.m4a"), durationSec: 3)
        set.addAudio(first)
        set.addAudio(AudioAttachment(url: URL(fileURLWithPath: "/tmp/a2.m4a"), durationSec: 4))
        XCTAssertEqual(set.entryType, .voice)
        XCTAssertEqual(set.audios.count, 2, "A second recording is appended, not a replacement")

        // Recordings are never dropped by a rule: photos/video are refused instead.
        XCTAssertNotNil(set.addPhotos([PhotoAttachment(imageData: Data())]))
        XCTAssertNotNil(set.setVideo(VideoAttachment(url: URL(fileURLWithPath: "/tmp/v0.mov"))))
        XCTAssertEqual(set.entryType, .voice)
        XCTAssertEqual(set.audios.count, 2)

        set.removeAudio(id: first.id)
        XCTAssertEqual(set.audios.count, 1)
        set.removeAudio(id: set.audios[0].id)
        XCTAssertEqual(set.entryType, .text)

        let notice = set.addPhotos([PhotoAttachment(imageData: Data())])
        XCTAssertEqual(set.entryType, .image)
        XCTAssertNil(notice)

        XCTAssertFalse(set.canRecordAudio)
        let audioNotice = set.addAudio(
            AudioAttachment(url: URL(fileURLWithPath: "/tmp/b.m4a"), durationSec: 2)
        )
        XCTAssertTrue(set.audios.isEmpty)
        XCTAssertNotNil(audioNotice)

        XCTAssertTrue(set.videoNeedsReplacementConfirm)
        set.setVideo(VideoAttachment(url: URL(fileURLWithPath: "/tmp/v.mov")))
        XCTAssertEqual(set.entryType, .video)
        XCTAssertTrue(set.photos.isEmpty)

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

    // MARK: - In-progress recording keeps the draft alive

    @MainActor
    func testDraftWithInProgressRecordingIsNotPrunedWhenTextEmpty() {
        // A recording manifest on disk (no text, no attachments) must keep the draft.
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("cevm-\(UUID().uuidString)", isDirectory: true)
        let drafts = DraftStore(directory: dir)
        defer { try? FileManager.default.removeItem(at: dir) }

        let vm = CreateEntryViewModel(
            request: CreateEntryRequest(),
            dependencies: CreateEntryDependencies(
                auth: MockAuthService(signedIn: true),
                speech: MockSpeechTranscriber(),
                entryProcessor: SpyEntryProcessor(),
                drafts: drafts
            )
        )
        drafts.updateRecording(draftId: vm.draftId,
                               DraftRecording(segmentFileNames: ["rec-0.caf"], isFinalized: false))

        vm.persistDraftNow()

        XCTAssertNotNil(drafts.load(vm.draftId), "recording-only draft must survive persist")
        XCTAssertEqual(drafts.load(vm.draftId)?.recording?.segmentFileNames, ["rec-0.caf"])
    }

    @MainActor
    func testDraftWithActiveFirstSegmentRecordingIsNotPrunedWhenTextEmpty() {
        // Manifest present but NO segment finalized yet (first segment still recording).
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("cevm-\(UUID().uuidString)", isDirectory: true)
        let drafts = DraftStore(directory: dir)
        defer { try? FileManager.default.removeItem(at: dir) }

        let vm = CreateEntryViewModel(
            request: CreateEntryRequest(),
            dependencies: CreateEntryDependencies(
                auth: MockAuthService(signedIn: true),
                speech: MockSpeechTranscriber(),
                entryProcessor: SpyEntryProcessor(),
                drafts: drafts
            )
        )
        drafts.updateRecording(draftId: vm.draftId,
                               DraftRecording(segmentFileNames: [], isFinalized: false))

        vm.persistDraftNow()

        XCTAssertNotNil(drafts.load(vm.draftId),
                        "an active first-segment recording (empty finalized list) must not be pruned")
    }
}
