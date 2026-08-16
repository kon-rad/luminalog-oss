import XCTest
@testable import LuminaLog

@MainActor
final class DraftStorePruneTests: XCTestCase {

    private var dir: URL!
    private var store: DraftStore!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("dprune-\(UUID().uuidString)", isDirectory: true)
        store = DraftStore(directory: dir)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    private func draft(_ id: String, text: String = "",
                       attachments: [DraftAttachment] = [],
                       recording: DraftRecording? = nil) -> DraftEntry {
        DraftEntry(draftId: id, text: text, promptText: nil,
                   createdAtEpoch: 1, updatedAtEpoch: 1,
                   attachments: attachments, recording: recording)
    }

    private func audioAttachment(_ fileName: String) -> DraftAttachment {
        DraftAttachment(id: UUID(), kind: .audio, fileName: fileName,
                        durationSec: 3, pixelWidth: nil, pixelHeight: nil, order: 0)
    }

    func testPruneDeletesTextOnlyEmptyDraft() {
        store.upsert(draft("d1"))
        store.pruneIfDisposable("d1")
        XCTAssertNil(store.load("d1"))
    }

    func testPruneKeepsDraftWithAudioAttachment() {
        store.upsert(draft("d1", attachments: [audioAttachment("a.m4a")]))
        store.pruneIfDisposable("d1")
        XCTAssertNotNil(store.load("d1"))
    }

    func testPruneKeepsDraftWithUnmergedRecordingManifest() {
        store.upsert(draft("d1", recording: DraftRecording(segmentFileNames: ["rec-0.caf"],
                                                           isFinalized: false)))
        store.pruneIfDisposable("d1")
        XCTAssertNotNil(store.load("d1"))
    }

    func testPruneKeepsDraftWhoseJSONLostAttachmentsButFilesRemain() throws {
        // Simulates a torn write: the JSON says empty, the audio is still on disk.
        store.upsert(draft("d1"))
        _ = try store.saveMedia(draftId: "d1", fileName: "orphan.m4a", data: Data("x".utf8))
        store.pruneIfDisposable("d1")
        XCTAssertNotNil(store.load("d1"))
    }

    func testPruneDeletesDraftWhoseOnlyDiskFileIsAPhoto() throws {
        // A removed photo must not pin an otherwise empty draft forever.
        store.upsert(draft("d1"))
        _ = try store.saveMedia(draftId: "d1", fileName: "left.jpg", data: Data("x".utf8))
        store.pruneIfDisposable("d1")
        XCTAssertNil(store.load("d1"))
    }

    func testPruneKeepsADraftThatStillHasText() {
        store.upsert(draft("d1", text: "keep me"))
        store.pruneIfDisposable("d1")
        XCTAssertEqual(store.load("d1")?.text, "keep me")
    }

    func testPruneKeepsADraftThatStillHasAPhoto() {
        let photo = DraftAttachment(id: UUID(), kind: .photo, fileName: "p.jpg",
                                    durationSec: nil, pixelWidth: 10, pixelHeight: 10, order: 0)
        store.upsert(draft("d1", attachments: [photo]))
        store.pruneIfDisposable("d1")
        XCTAssertNotNil(store.load("d1"))
    }

    func testExplicitDeleteStillRemovesADraftHoldingAudio() {
        store.upsert(draft("d1", attachments: [audioAttachment("a.m4a")]))
        store.delete("d1")
        XCTAssertNil(store.load("d1"))
    }

    func testRemoveMediaDeletesEveryFileNamedForTheAttachment() throws {
        let id = UUID()
        _ = try store.saveMedia(draftId: "d1", fileName: "\(id.uuidString).m4a",
                                data: Data("a".utf8))
        _ = try store.saveMedia(draftId: "d1", fileName: "\(id.uuidString).mov",
                                data: Data("v".utf8))
        _ = try store.saveMedia(draftId: "d1", fileName: "keep.m4a", data: Data("k".utf8))

        store.removeMedia(draftId: "d1", attachmentId: id)

        XCTAssertNil(store.mediaURL(draftId: "d1", fileName: "\(id.uuidString).m4a"))
        XCTAssertNil(store.mediaURL(draftId: "d1", fileName: "\(id.uuidString).mov"))
        XCTAssertNotNil(store.mediaURL(draftId: "d1", fileName: "keep.m4a"))
    }

    func testRemoveMediaIsANoOpForAnUnsafeDraftId() {
        // Path-traversal guard: must not throw and must not touch anything.
        store.removeMedia(draftId: "../escape", attachmentId: UUID())
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir.path))
    }
}
