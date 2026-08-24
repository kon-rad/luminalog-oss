import XCTest
@testable import LuminaLog

@MainActor
final class RecordingsRecoveryViewModelTests: XCTestCase {

    private final class FakeMerger: RecordingMerging {
        var mergedDuration: TimeInterval = 5
        var mergeError: Error?
        func duration(of url: URL) async -> TimeInterval { mergedDuration }
        func merge(_ segments: [URL], to out: URL) async throws {
            if let mergeError { throw mergeError }
            try? Data("merged".utf8).write(to: out)
        }
    }

    private final class SpyProcessor: EntryProcessor {
        var retried: [String] = []
        func enqueue(_ job: EntryProcessingJob) {}
        func retry(draftId: String) { retried.append(draftId) }
        func resumePendingJobs() async {}
        func sweepStuckEntries() async {}
    }

    private var dir: URL!
    private var uploadsDir: URL!
    private var drafts: DraftStore!
    private var uploads: UploadJournal!
    private var merger: FakeMerger!
    private var processor: SpyProcessor!
    private var viewModel: RecordingsRecoveryViewModel!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("rrvm-\(UUID().uuidString)", isDirectory: true)
        uploadsDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("rrvmup-\(UUID().uuidString)", isDirectory: true)
        drafts = DraftStore(directory: dir)
        uploads = UploadJournal(directory: uploadsDir)
        merger = FakeMerger()
        processor = SpyProcessor()
        viewModel = RecordingsRecoveryViewModel(
            inventory: RecordingInventory(drafts: drafts, uploads: uploads, merger: merger),
            drafts: drafts,
            processor: processor,
            merger: merger
        )
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
        try? FileManager.default.removeItem(at: uploadsDir)
    }

    private func stageUnsavedAudio(_ id: String, text: String = "note",
                                   fileName: String = "a.m4a") throws {
        _ = try drafts.saveMedia(draftId: id, fileName: fileName, data: Data("audio".utf8))
        drafts.upsert(DraftEntry(
            draftId: id, text: text, promptText: nil,
            createdAtEpoch: 100, updatedAtEpoch: 100,
            attachments: [DraftAttachment(id: UUID(), kind: .audio, fileName: fileName,
                                          durationSec: 4, pixelWidth: nil, pixelHeight: nil,
                                          order: 0)]
        ))
    }

    func testRefreshPopulatesItems() async throws {
        try stageUnsavedAudio("d1")
        await viewModel.refresh()
        XCTAssertEqual(viewModel.items.count, 1)
        XCTAssertFalse(viewModel.isLoading)
    }

    func testDeleteRemovesTheFileAndTheRow() async throws {
        try stageUnsavedAudio("d1", text: "")
        await viewModel.refresh()
        let item = try XCTUnwrap(viewModel.items.first)

        await viewModel.delete(item)

        XCTAssertNil(drafts.mediaURL(draftId: "d1", fileName: "a.m4a"))
        XCTAssertTrue(viewModel.items.isEmpty)
    }

    func testDeleteOfTheOnlyContentPrunesTheDraft() async throws {
        try stageUnsavedAudio("d1", text: "")
        await viewModel.refresh()
        let item = try XCTUnwrap(viewModel.items.first)

        await viewModel.delete(item)

        // The draft held nothing else, so it prunes away entirely.
        XCTAssertNil(drafts.load("d1"))
    }

    func testDeleteKeepsTheDraftWhenItStillHasText() async throws {
        try stageUnsavedAudio("d1", text: "keep me")
        await viewModel.refresh()
        let item = try XCTUnwrap(viewModel.items.first)

        await viewModel.delete(item)

        XCTAssertEqual(drafts.load("d1")?.text, "keep me")
        XCTAssertTrue(drafts.load("d1")?.attachments.isEmpty ?? false)
    }

    func testRetryUploadCallsTheProcessor() async throws {
        try stageUnsavedAudio("d1")
        await viewModel.refresh()
        let item = try XCTUnwrap(viewModel.items.first)

        await viewModel.retryUpload(item)

        XCTAssertEqual(processor.retried, ["d1"])
    }

    func testRecoverOrphanAttachesItToADraft() async throws {
        // A media file with no owning draft JSON.
        _ = try drafts.saveMedia(draftId: "ghost", fileName: "lost.m4a", data: Data("a".utf8))
        await viewModel.refresh()
        let item = try XCTUnwrap(viewModel.items.first)
        XCTAssertEqual(item.status, .orphaned)

        await viewModel.recoverIntoDraft(item)

        let draft = try XCTUnwrap(drafts.load("ghost"))
        XCTAssertEqual(draft.attachments.count, 1)
        XCTAssertEqual(draft.attachments.first?.kind, .audio)
        XCTAssertEqual(draft.attachments.first?.fileName, "lost.m4a")
        XCTAssertEqual(viewModel.items.first?.status, .unsaved)
    }

    func testRecoverNeedsRepairMergesSegmentsIntoAnAttachment() async throws {
        let mediaDir = drafts.mediaDirectory(for: "d1")!
        try FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true)
        try Data("s0".utf8).write(to: mediaDir.appendingPathComponent("rec-0.caf"))
        drafts.upsert(DraftEntry(
            draftId: "d1", text: "voice", promptText: nil,
            createdAtEpoch: 100, updatedAtEpoch: 100, attachments: [],
            recording: DraftRecording(segmentFileNames: ["rec-0.caf"], isFinalized: false)
        ))
        merger.mergeError = RecordingMergeError.noReadableSegments
        await viewModel.refresh()
        let item = try XCTUnwrap(viewModel.items.first)
        XCTAssertEqual(item.status, .needsRepair)

        // The retry succeeds this time.
        merger.mergeError = nil
        await viewModel.recoverIntoDraft(item)

        let draft = try XCTUnwrap(drafts.load("d1"))
        XCTAssertEqual(draft.attachments.count, 1)
        XCTAssertEqual(draft.attachments.first?.kind, .audio)
        XCTAssertNil(draft.recording)
    }

    func testFailedRepairLeavesTheSegmentsAlone() async throws {
        let mediaDir = drafts.mediaDirectory(for: "d1")!
        try FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true)
        try Data("s0".utf8).write(to: mediaDir.appendingPathComponent("rec-0.caf"))
        drafts.upsert(DraftEntry(
            draftId: "d1", text: "voice", promptText: nil,
            createdAtEpoch: 100, updatedAtEpoch: 100, attachments: [],
            recording: DraftRecording(segmentFileNames: ["rec-0.caf"], isFinalized: false)
        ))
        merger.mergeError = RecordingMergeError.noReadableSegments
        await viewModel.refresh()
        let item = try XCTUnwrap(viewModel.items.first)

        await viewModel.recoverIntoDraft(item)   // still failing

        XCTAssertTrue(FileManager.default.fileExists(
            atPath: mediaDir.appendingPathComponent("rec-0.caf").path))
        XCTAssertEqual(viewModel.items.first?.status, .needsRepair)
    }

    func testSectionsOrderNeedsAttentionFirst() async throws {
        try stageUnsavedAudio("d1")
        _ = try drafts.saveMedia(draftId: "ghost", fileName: "lost.m4a", data: Data("a".utf8))
        await viewModel.refresh()

        let titles = viewModel.sections.map(\.title)
        XCTAssertEqual(titles.first, "Needs attention")
        XCTAssertTrue(titles.contains("Unsaved"))
    }
}
