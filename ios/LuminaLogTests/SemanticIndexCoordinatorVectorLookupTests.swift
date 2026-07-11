import XCTest
import CryptoKit
@testable import LuminaLog

final class SemanticIndexCoordinatorVectorLookupTests: XCTestCase {
    private final class FixedEmbedder: TextEmbedder {
        func embed(_ text: String) async throws -> EmbeddingVector {
            EmbeddingVector(AnchorConstants.axes[0].map { Float($0) })
        }
    }
    private final class NoopSync: VectorSyncService {
        func upsert(_ items: [VectorSyncItem]) async throws {}
        func list() async throws -> [VectorSyncItem] { [] }
        func delete(entryId: String) async throws {}
    }

    func testVectorForReturnsCachedAfterIndexAndNilBefore() async throws {
        let dek = SymmetricKey(size: .bits256)
        let c = SemanticIndexCoordinator(embedder: FixedEmbedder(), service: NoopSync(), dek: { dek })
        XCTAssertNil(c.vector(for: "e1"))
        try await c.indexEntry(id: "e1", text: "hello")
        XCTAssertEqual(c.vector(for: "e1")?.dimension, 512)
    }
}
