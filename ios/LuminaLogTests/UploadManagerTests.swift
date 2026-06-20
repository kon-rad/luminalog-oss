import XCTest
@testable import LuminaLog

final class UploadManagerTests: XCTestCase {

    private final class FakeTransport: UploadTransport {
        var statuses: [Int]              // status code per call, in order
        private(set) var calls = 0
        init(_ s: [Int]) { statuses = s }
        func put(file: URL, to url: URL) async -> Int {
            defer { calls += 1 }
            return statuses[min(calls, statuses.count - 1)]
        }
    }

    private func dir() -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true); return u
    }

    private func entry(_ id: String) -> PendingEntry {
        let ciphertext = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? Data([0,1,2]).write(to: ciphertext)
        return PendingEntry(draftId: id, userId: "u1", type: .video, title: "t", content: "",
            wordCount: 0, transcriptStatus: .processing, createdAtEpoch: 0, promptText: nil,
            uploads: [PendingUpload(attachmentId: UUID(), kind: .video, journalId: id,
                s3Key: "users/u1/journals/\(id)/video-x.mp4", encryptedPath: ciphertext.path,
                durationSec: 1, width: 1280, height: 720, thumbnailS3Key: nil)])
    }

    /// Like `entry(_:)` but with TWO uploads (two distinct attachmentIds, each
    /// with its own ciphertext temp file).
    private func twoUploadEntry(_ id: String) -> PendingEntry {
        func ciphertext() -> URL {
            let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try? Data([0,1,2]).write(to: u)
            return u
        }
        let c1 = ciphertext(); let c2 = ciphertext()
        return PendingEntry(draftId: id, userId: "u1", type: .video, title: "t", content: "",
            wordCount: 0, transcriptStatus: .processing, createdAtEpoch: 0, promptText: nil,
            uploads: [
                PendingUpload(attachmentId: UUID(), kind: .video, journalId: id,
                    s3Key: "users/u1/journals/\(id)/video-a.mp4", encryptedPath: c1.path,
                    durationSec: 1, width: 1280, height: 720, thumbnailS3Key: nil),
                PendingUpload(attachmentId: UUID(), kind: .video, journalId: id,
                    s3Key: "users/u1/journals/\(id)/video-b.mp4", encryptedPath: c2.path,
                    durationSec: 1, width: 1280, height: 720, thumbnailS3Key: nil),
            ])
    }

    @MainActor
    func testSuccessFinalizesOnce() async throws {
        let journal = UploadJournal(directory: dir())
        var finalized: [String] = []
        let mgr = UploadManager(journal: journal, transport: FakeTransport([200]),
                                presign: { _ in URL(string: "https://signed/put")! },
                                onFinalize: { finalized.append($0.draftId) },
                                maxAttempts: 5, backoff: { _ in 0 })
        let e = entry("d1"); try journal.upsert(e)
        await mgr.startAll(for: e)
        XCTAssertEqual(finalized, ["d1"])
        XCTAssertNil(journal.entry(draftId: "d1")) // removed after finalize+cleanup
    }

    @MainActor
    func testTransientFailureThenSuccess() async throws {
        let journal = UploadJournal(directory: dir())
        var finalized: [String] = []
        let mgr = UploadManager(journal: journal, transport: FakeTransport([500, 200]),
                                presign: { _ in URL(string: "https://signed/put")! },
                                onFinalize: { finalized.append($0.draftId) },
                                maxAttempts: 5, backoff: { _ in 0 })
        let e = entry("d2"); try journal.upsert(e)
        await mgr.startAll(for: e)
        XCTAssertEqual(finalized, ["d2"])
    }

    @MainActor
    func testCapMarksFailed() async throws {
        let journal = UploadJournal(directory: dir())
        var failedDrafts: [String] = []
        let mgr = UploadManager(journal: journal, transport: FakeTransport([500]),
                                presign: { _ in URL(string: "https://signed/put")! },
                                onFinalize: { _ in },
                                onPermanentFailure: { failedDrafts.append($0) },
                                maxAttempts: 3, backoff: { _ in 0 })
        let e = entry("d3"); try journal.upsert(e)
        await mgr.startAll(for: e)
        XCTAssertEqual(failedDrafts, ["d3"])
        XCTAssertEqual(journal.entry(draftId: "d3")?.uploads.first?.state, .failed)
    }

    @MainActor
    func test403RepresignsSameKeyThenSucceeds() async throws {
        let journal = UploadJournal(directory: dir())
        var presignCount = 0
        var finalized: [String] = []
        let mgr = UploadManager(journal: journal, transport: FakeTransport([403, 200]),
                                presign: { _ in presignCount += 1; return URL(string: "https://signed/put")! },
                                onFinalize: { finalized.append($0.draftId) },
                                maxAttempts: 5, backoff: { _ in 0 })
        let e = entry("d4"); try journal.upsert(e)
        await mgr.startAll(for: e)
        XCTAssertEqual(finalized, ["d4"])
        XCTAssertGreaterThanOrEqual(presignCount, 2, "403 re-presigns the same key without counting as a failed attempt")
    }

    /// A PERSISTENT 403 must be bounded: it re-presigns at most twice, then falls
    /// through to bumpOrFail so it backs off and eventually caps. Without the
    /// 403 bound this would loop forever and hang the test run.
    @MainActor
    func testPersistentForbiddenEventuallyCaps() async throws {
        let journal = UploadJournal(directory: dir())
        var failedDrafts: [String] = []
        let mgr = UploadManager(journal: journal, transport: FakeTransport([403]),
                                presign: { _ in URL(string: "https://signed/put")! },
                                onFinalize: { _ in },
                                onPermanentFailure: { failedDrafts.append($0) },
                                maxAttempts: 3, backoff: { _ in 0 })
        let e = entry("d5"); try journal.upsert(e)
        await mgr.startAll(for: e)
        XCTAssertEqual(failedDrafts, ["d5"])
        XCTAssertEqual(journal.entry(draftId: "d5")?.uploads.first?.state, .failed)
    }

    /// Multi-attachment partial failure: one upload caps (.failed), the other
    /// succeeds. onFinalize must NOT fire, onPermanentFailure must fire, and the
    /// journal record must be RETAINED for caller-driven retry.
    @MainActor
    func testMultiAttachmentPartialFailureRetainsRecord() async throws {
        let journal = UploadJournal(directory: dir())
        var finalized: [String] = []
        var failedDrafts: [String] = []
        // Shared call counter across all uploads/attempts:
        //   call 0 -> 500 (upload A attempt 1)
        //   call 1 -> 500 (upload A attempt 2 -> caps, maxAttempts 2)
        //   call 2 -> 200 (upload B succeeds)
        let mgr = UploadManager(journal: journal, transport: FakeTransport([500, 500, 200]),
                                presign: { _ in URL(string: "https://signed/put")! },
                                onFinalize: { finalized.append($0.draftId) },
                                onPermanentFailure: { failedDrafts.append($0) },
                                maxAttempts: 2, backoff: { _ in 0 })
        let e = twoUploadEntry("d6"); try journal.upsert(e)
        await mgr.startAll(for: e)
        XCTAssertEqual(finalized, [], "onFinalize must not fire when any upload permanently fails")
        XCTAssertTrue(failedDrafts.contains("d6"))
        let refreshed = journal.entry(draftId: "d6")
        XCTAssertNotNil(refreshed, "journal record retained for caller-driven retry")
        let states = refreshed?.uploads.map { $0.state } ?? []
        XCTAssertEqual(states.filter { $0 == .failed }.count, 1)
        XCTAssertEqual(states.filter { $0 == .uploaded }.count, 1)
    }
}
