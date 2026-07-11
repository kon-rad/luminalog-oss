import XCTest
@testable import LuminaLog

private final class CaptureSync: ConstellationSyncing {
    var uploaded: [ConstellationPoint]?
    var uploadCount = 0
    func upload(points: [ConstellationPoint]) async throws { uploaded = points; uploadCount += 1 }
}
private final class FakeEmbedder2: TextEmbedder {
    func embed(_ text: String) async throws -> EmbeddingVector {
        EmbeddingVector(AnchorConstants.axes[0].map { Float($0) })
    }
}

@MainActor
final class ConstellationCoordinatorTests: XCTestCase {
    private func d(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    private func makeCoord(_ sync: CaptureSync, entries: [(id: String, text: String, wordCount: Int, createdAt: Date)]) -> ConstellationCoordinator {
        ConstellationCoordinator(
            builder: ConstellationBuilder(embedder: FakeEmbedder2()),
            sync: sync,
            entriesProvider: { entries })
    }

    func testRebuildBuildsAndUploadsWhenFlagOn() async throws {
        DevFlags.aiModel1 = true
        let sync = CaptureSync()
        let coord = makeCoord(sync, entries: [(id: "a", text: "V", wordCount: 800, createdAt: d("2024-10-04T08:00:00Z"))])
        let count = try await coord.rebuildAndSync()
        XCTAssertEqual(count, 1)
        XCTAssertEqual(sync.uploaded?.count, 1)
    }

    func testRebuildIsNoOpWhenFlagOff() async throws {
        DevFlags.aiModel1 = false
        let sync = CaptureSync()
        let coord = makeCoord(sync, entries: [(id: "a", text: "V", wordCount: 800, createdAt: d("2024-10-04T08:00:00Z"))])
        let count = try await coord.rebuildAndSync()
        XCTAssertEqual(count, 0)
        XCTAssertNil(sync.uploaded)
        DevFlags.aiModel1 = true // restore DEBUG default
    }

    func testRebuildDoesNotUploadWhenCorpusEmpty() async throws {
        DevFlags.aiModel1 = true
        let sync = CaptureSync()
        let coord = makeCoord(sync, entries: [])
        let count = try await coord.rebuildAndSync()
        XCTAssertEqual(count, 0)
        XCTAssertNil(sync.uploaded)
    }

    /// Three rapid schedule calls collapse into at most one in-flight + one queued
    /// run — not three concurrent full rebuilds.
    func testScheduleRebuildCoalesces() async throws {
        DevFlags.aiModel1 = true
        let sync = CaptureSync()
        let coord = makeCoord(sync, entries: [(id: "a", text: "V", wordCount: 800, createdAt: d("2024-10-04T08:00:00Z"))])
        coord.scheduleRebuild(); coord.scheduleRebuild(); coord.scheduleRebuild()
        try await Task.sleep(nanoseconds: 250_000_000) // let the coalesced work drain
        XCTAssertEqual(sync.uploaded?.count, 1)
        XCTAssertLessThanOrEqual(sync.uploadCount, 2) // 1 in-flight + at most 1 queued
    }
}
