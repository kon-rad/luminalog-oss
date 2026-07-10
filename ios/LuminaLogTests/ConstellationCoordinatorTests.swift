import XCTest
@testable import LuminaLog

private final class CaptureSync: ConstellationSyncing {
    var uploaded: [ConstellationPoint]?
    func upload(points: [ConstellationPoint]) async throws { uploaded = points }
}
private final class FakeEmbedder2: TextEmbedder {
    func embed(_ text: String) async throws -> EmbeddingVector {
        EmbeddingVector(AnchorConstants.axes[0].map { Float($0) })
    }
}

final class ConstellationCoordinatorTests: XCTestCase {
    private func d(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    func testRebuildBuildsAndUploadsWhenFlagOn() async throws {
        DevFlags.aiModel1 = true
        let sync = CaptureSync()
        let coord = ConstellationCoordinator(
            builder: ConstellationBuilder(embedder: FakeEmbedder2()),
            sync: sync,
            entriesProvider: { [(text: "V", wordCount: 800, createdAt: self.d("2024-10-04T08:00:00Z"))] })
        let count = try await coord.rebuildAndSync()
        XCTAssertEqual(count, 1)
        XCTAssertEqual(sync.uploaded?.count, 1)
    }

    func testRebuildIsNoOpWhenFlagOff() async throws {
        DevFlags.aiModel1 = false
        let sync = CaptureSync()
        let coord = ConstellationCoordinator(
            builder: ConstellationBuilder(embedder: FakeEmbedder2()),
            sync: sync,
            entriesProvider: { [(text: "V", wordCount: 800, createdAt: self.d("2024-10-04T08:00:00Z"))] })
        let count = try await coord.rebuildAndSync()
        XCTAssertEqual(count, 0)
        XCTAssertNil(sync.uploaded)
        DevFlags.aiModel1 = true // restore DEBUG default
    }
}
