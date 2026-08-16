import XCTest
@testable import LuminaLog

@MainActor
final class RecordingInventoryTests: XCTestCase {

    /// Duration keyed by lastPathComponent; merge writes a stub file or throws.
    private final class FakeMerger: RecordingMerging {
        var durations: [String: TimeInterval] = [:]
        var mergedDuration: TimeInterval = 7
        var mergeError: Error?
        func duration(of url: URL) async -> TimeInterval {
            durations[url.lastPathComponent] ?? mergedDuration
        }
        func merge(_ segments: [URL], to out: URL) async throws {
            if let mergeError { throw mergeError }
            try? Data("stub".utf8).write(to: out)
        }
    }

    private var dir: URL!
    private var uploadsDir: URL!
    private var drafts: DraftStore!
    private var uploads: UploadJournal!
    private var merger: FakeMerger!
    private var inventory: RecordingInventory!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("inv-\(UUID().uuidString)", isDirectory: true)
        uploadsDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("invup-\(UUID().uuidString)", isDirectory: true)
        drafts = DraftStore(directory: dir)
        uploads = UploadJournal(directory: uploadsDir)
        merger = FakeMerger()
        inventory = RecordingInventory(drafts: drafts, uploads: uploads,
                                       merger: merger, staleAfter: 600)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
        try? FileManager.default.removeItem(at: uploadsDir)
    }

    @discardableResult
    private func stageAudioDraft(_ id: String, fileName: String, handedOff: Bool,
                                 updatedAt: Double) throws -> UUID {
        let attachmentId = UUID()
        _ = try drafts.saveMedia(draftId: id, fileName: fileName, data: Data("audio".utf8))
        var draft = DraftEntry(
            draftId: id, text: "morning notes", promptText: nil,
            createdAtEpoch: updatedAt, updatedAtEpoch: updatedAt,
            attachments: [DraftAttachment(id: attachmentId, kind: .audio, fileName: fileName,
                                          durationSec: 12, pixelWidth: nil, pixelHeight: nil,
                                          order: 0)]
        )
        draft.handedOff = handedOff
        drafts.upsert(draft)
        return attachmentId
    }

    private func pendingEntry(_ draftId: String, state: PendingUploadState) -> PendingEntry {
        PendingEntry(
            draftId: draftId, userId: "u1", type: .voice, title: "t", content: "c",
            wordCount: 1, transcriptStatus: nil, createdAtEpoch: 100, promptText: nil,
            uploads: [PendingUpload(attachmentId: UUID(), kind: .audio, journalId: draftId,
                                    s3Key: "k", encryptedPath: "/tmp/x", durationSec: 12,
                                    width: nil, height: nil, thumbnailS3Key: nil, state: state)]
        )
    }

    // MARK: Draft-derived rows

    func testUnsavedDraftAudioIsReported() async throws {
        try stageAudioDraft("d1", fileName: "a.m4a", handedOff: false, updatedAt: 100)
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.status, .unsaved)
        XCTAssertEqual(items.first?.kind, .audio)
        XCTAssertEqual(items.first?.draftId, "d1")
        XCTAssertEqual(items.first?.durationSec, 12)
        XCTAssertEqual(items.first?.title, "morning notes")
    }

    func testHandedOffDraftWithAllUploadsCompleteIsOmitted() async throws {
        try stageAudioDraft("d1", fileName: "a.m4a", handedOff: true, updatedAt: 100)
        try uploads.upsert(pendingEntry("d1", state: .uploaded))
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertTrue(items.isEmpty)
    }

    func testHandedOffDraftMidUploadIsAwaitingUpload() async throws {
        try stageAudioDraft("d1", fileName: "a.m4a", handedOff: true, updatedAt: 100)
        try uploads.upsert(pendingEntry("d1", state: .uploading))
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.first?.status, .awaitingUpload)
    }

    func testHandedOffDraftWithFailedUploadIsUploadFailed() async throws {
        try stageAudioDraft("d1", fileName: "a.m4a", handedOff: true, updatedAt: 100)
        try uploads.upsert(pendingEntry("d1", state: .failed))
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.first?.status, .uploadFailed)
    }

    func testStaleHandedOffDraftWithNoJournalRecordIsUploadFailed() async throws {
        try stageAudioDraft("d1", fileName: "a.m4a", handedOff: true, updatedAt: 100)
        // 900s later, past the 600s staleness threshold, still no journal record.
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 1000))
        XCTAssertEqual(items.first?.status, .uploadFailed)
    }

    func testFreshHandedOffDraftWithNoJournalRecordIsAwaitingUpload() async throws {
        try stageAudioDraft("d1", fileName: "a.m4a", handedOff: true, updatedAt: 100)
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.first?.status, .awaitingUpload)
    }

    func testTitleFallsBackToTheDateWhenTheDraftHasNoText() async throws {
        _ = try drafts.saveMedia(draftId: "d1", fileName: "a.m4a", data: Data("a".utf8))
        drafts.upsert(DraftEntry(
            draftId: "d1", text: "   ", promptText: nil,
            createdAtEpoch: 100, updatedAtEpoch: 100,
            attachments: [DraftAttachment(id: UUID(), kind: .audio, fileName: "a.m4a",
                                          durationSec: 3, pixelWidth: nil, pixelHeight: nil,
                                          order: 0)]
        ))
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertFalse(items.first?.title.isEmpty ?? true)
        XCTAssertNotEqual(items.first?.title, "   ")
    }

    func testPhotoOnlyDraftIsNotReported() async throws {
        _ = try drafts.saveMedia(draftId: "d1", fileName: "p.jpg", data: Data("p".utf8))
        drafts.upsert(DraftEntry(
            draftId: "d1", text: "photo entry", promptText: nil,
            createdAtEpoch: 100, updatedAtEpoch: 100,
            attachments: [DraftAttachment(id: UUID(), kind: .photo, fileName: "p.jpg",
                                          durationSec: nil, pixelWidth: 10, pixelHeight: 10,
                                          order: 0)]
        ))
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertTrue(items.isEmpty)
    }

    func testResultsAreSortedNewestFirst() async throws {
        try stageAudioDraft("older", fileName: "a.m4a", handedOff: false, updatedAt: 100)
        try stageAudioDraft("newer", fileName: "b.m4a", handedOff: false, updatedAt: 500)
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 600))
        XCTAssertEqual(items.map(\.draftId), ["newer", "older"])
    }

    // MARK: Orphan and repair rows

    func testMediaWithNoOwningDraftJSONIsOrphaned() async throws {
        // Write a media file with no draft JSON alongside it.
        _ = try drafts.saveMedia(draftId: "ghost", fileName: "lost.m4a", data: Data("a".utf8))
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.status, .orphaned)
        XCTAssertEqual(items.first?.kind, .audio)
        XCTAssertEqual(items.first?.draftId, "ghost")
    }

    func testUnreferencedFileInsideAKnownDraftIsOrphaned() async throws {
        try stageAudioDraft("d1", fileName: "a.m4a", handedOff: false, updatedAt: 100)
        // A recording the JSON no longer references (rule-displaced audio).
        _ = try drafts.saveMedia(draftId: "d1", fileName: "displaced.m4a", data: Data("x".utf8))

        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items.first(where: { $0.fileURL.lastPathComponent == "displaced.m4a" })?.status,
                       .orphaned)
        XCTAssertEqual(items.first(where: { $0.fileURL.lastPathComponent == "a.m4a" })?.status,
                       .unsaved)
    }

    func testPhotoFileIsNeverReportedAsOrphaned() async throws {
        _ = try drafts.saveMedia(draftId: "ghost", fileName: "left.jpg", data: Data("p".utf8))
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertTrue(items.isEmpty)
    }

    func testVideoOrphanIsReportedAsVideoKind() async throws {
        _ = try drafts.saveMedia(draftId: "ghost", fileName: "clip.mov", data: Data("v".utf8))
        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.first?.kind, .video)
    }

    func testMergeableManifestIsRepairedAndReportedAsUnsaved() async throws {
        let mediaDir = drafts.mediaDirectory(for: "d1")!
        try FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true)
        try Data("seg".utf8).write(to: mediaDir.appendingPathComponent("rec-0.caf"))
        drafts.upsert(DraftEntry(
            draftId: "d1", text: "voice note", promptText: nil,
            createdAtEpoch: 100, updatedAtEpoch: 100, attachments: [],
            recording: DraftRecording(segmentFileNames: ["rec-0.caf"], isFinalized: false)
        ))

        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.status, .unsaved)
        XCTAssertEqual(items.first?.fileURL.pathExtension, "m4a")
    }

    func testUnmergeableManifestIsReportedAsNeedsRepair() async throws {
        merger.mergeError = RecordingMergeError.noReadableSegments
        let mediaDir = drafts.mediaDirectory(for: "d1")!
        try FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true)
        try Data("seg0".utf8).write(to: mediaDir.appendingPathComponent("rec-0.caf"))
        try Data("seg1".utf8).write(to: mediaDir.appendingPathComponent("rec-1.caf"))
        drafts.upsert(DraftEntry(
            draftId: "d1", text: "voice note", promptText: nil,
            createdAtEpoch: 100, updatedAtEpoch: 100, attachments: [],
            recording: DraftRecording(segmentFileNames: ["rec-0.caf", "rec-1.caf"],
                                      isFinalized: false)
        ))

        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.status, .needsRepair)
        XCTAssertEqual(items.first?.segmentURLs.count, 2)
        XCTAssertEqual(items.first?.draftId, "d1")
    }

    func testSegmentsOfAnUnmergeableManifestAreNotAlsoReportedAsOrphans() async throws {
        merger.mergeError = RecordingMergeError.noReadableSegments
        let mediaDir = drafts.mediaDirectory(for: "d1")!
        try FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true)
        try Data("seg0".utf8).write(to: mediaDir.appendingPathComponent("rec-0.caf"))
        drafts.upsert(DraftEntry(
            draftId: "d1", text: "", promptText: nil,
            createdAtEpoch: 100, updatedAtEpoch: 100, attachments: [],
            recording: DraftRecording(segmentFileNames: ["rec-0.caf"], isFinalized: false)
        ))

        let items = await inventory.refresh(now: Date(timeIntervalSince1970: 200))
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.status, .needsRepair)
    }
}
