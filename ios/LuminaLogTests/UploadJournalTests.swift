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

    func testOverwritePreservesOtherFields() throws {
        let dir = tempDir()
        let j = UploadJournal(directory: dir)
        let entry = sampleEntry()
        try j.upsert(entry)

        // Mutate ONE field (title), leave everything else alone.
        try j.mutate(draftId: "draft-1") { e in
            e.title = "new title"
        }

        let reloaded = j.entry(draftId: "draft-1")!
        XCTAssertEqual(reloaded.title, "new title")
        // Uploads array and other fields are untouched.
        XCTAssertEqual(reloaded.uploads, entry.uploads)
        XCTAssertEqual(reloaded.content, entry.content)
        XCTAssertEqual(reloaded.wordCount, entry.wordCount)
        XCTAssertEqual(reloaded.userId, entry.userId)
        XCTAssertEqual(reloaded.transcriptStatus, entry.transcriptStatus)
    }

    func testCorruptFileIsQuarantinedAndSkipped() throws {
        let dir = tempDir()
        let j = UploadJournal(directory: dir)

        // A garbage .json that cannot be decoded as a PendingEntry.
        let garbage = dir.appendingPathComponent("something.json")
        try Data("not json at all }{".utf8).write(to: garbage)

        try j.upsert(sampleEntry())

        // allPending returns only the valid entry; the garbage triggers quarantine.
        XCTAssertEqual(j.allPending().map(\.draftId), ["draft-1"])

        // The garbage file is now `.corrupt` and no longer a `.json`.
        XCTAssertFalse(FileManager.default.fileExists(atPath: garbage.path))
        let quarantined = dir.appendingPathComponent("something.json.corrupt")
        XCTAssertTrue(FileManager.default.fileExists(atPath: quarantined.path))
    }

    func testConcurrentMutationsDoNotLoseUpdates() throws {
        let dir = tempDir()
        let j = UploadJournal(directory: dir)

        // Build an entry with TWO uploads.
        let a0 = PendingUpload(attachmentId: UUID(), kind: .video, journalId: "draft-1",
                               s3Key: "k0", encryptedPath: "/tmp/0", durationSec: 1,
                               width: 1, height: 1, thumbnailS3Key: nil)
        let a1 = PendingUpload(attachmentId: UUID(), kind: .video, journalId: "draft-1",
                               s3Key: "k1", encryptedPath: "/tmp/1", durationSec: 1,
                               width: 1, height: 1, thumbnailS3Key: nil)
        var entry = sampleEntry()
        entry.uploads = [a0, a1]
        try j.upsert(entry)

        let ids = [a0.attachmentId, a1.attachmentId]
        DispatchQueue.concurrentPerform(iterations: 2) { i in
            try? j.markUploaded(draftId: "draft-1", attachmentId: ids[i], s3Key: "k\(i)")
        }

        let reloaded = j.entry(draftId: "draft-1")!
        XCTAssertTrue(reloaded.uploads.allSatisfy { $0.state == .uploaded },
                      "Concurrent mutations must not lose an update")
    }
}
