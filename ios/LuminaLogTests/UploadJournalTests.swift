import XCTest
@testable import LuminaLog

final class UploadJournalTests: XCTestCase {

    private func tempDir() -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    private func sampleEntry(id: String = "draft-1") -> PendingEntry {
        PendingEntry(
            draftId: id, userId: "u1", type: .video, title: "t", content: "c",
            wordCount: 1, transcriptStatus: .processing, createdAtEpoch: 0, promptText: nil,
            uploads: [
                PendingUpload(attachmentId: UUID(), kind: .video,
                              journalId: id,
                              s3Key: "users/u1/journals/\(id)/video-x.mp4",
                              encryptedPath: "/tmp/x", durationSec: 3, width: 1280, height: 720,
                              thumbnailS3Key: nil)
            ]
        )
    }

    func testRoundTripsAcrossInstances() throws {
        let dir = tempDir()
        let j1 = UploadJournal(directory: dir)
        try j1.upsert(sampleEntry())
        let j2 = UploadJournal(directory: dir)   // fresh instance reads from disk (simulates relaunch)
        XCTAssertEqual(j2.allPending().map(\.draftId), ["draft-1"])
        XCTAssertEqual(j2.allPending().first?.uploads.first?.state, .pending)
    }

    func testMarkingAllUploadedMakesEntryReadyToFinalize() throws {
        let dir = tempDir()
        let j = UploadJournal(directory: dir)
        let entry = sampleEntry()
        try j.upsert(entry)
        let uploadId = entry.uploads[0].attachmentId
        try j.markUploaded(draftId: "draft-1", attachmentId: uploadId, s3Key: entry.uploads[0].s3Key)
        XCTAssertTrue(j.entry(draftId: "draft-1")!.allUploaded)
    }

    func testRemoveDeletesRecord() throws {
        let dir = tempDir()
        let j = UploadJournal(directory: dir)
        try j.upsert(sampleEntry())
        j.remove(draftId: "draft-1")
        XCTAssertTrue(UploadJournal(directory: dir).allPending().isEmpty)
    }

    func testMutateUpdatesAttemptCount() throws {
        let dir = tempDir()
        let j = UploadJournal(directory: dir)
        let entry = sampleEntry()
        try j.upsert(entry)
        let aid = entry.uploads[0].attachmentId
        try j.mutate(draftId: "draft-1") { e in
            if let i = e.uploads.firstIndex(where: { $0.attachmentId == aid }) { e.uploads[i].attemptCount += 1 }
        }
        XCTAssertEqual(j.entry(draftId: "draft-1")?.uploads.first?.attemptCount, 1)
    }
}
