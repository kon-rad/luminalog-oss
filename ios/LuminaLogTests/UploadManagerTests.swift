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
}
