import XCTest
@testable import LuminaLog

final class VectorIndexTests: XCTestCase {

    private func ids(_ results: [(entryId: String, score: Float)]) -> [String] {
        results.map(\.entryId)
    }

    // MARK: - Ranking

    func testNearDuplicateRanksAboveDissimilar() {
        var index = VectorIndex()
        let query = EmbeddingVector([1, 0, 0])
        index.upsert(entryId: "near", vector: EmbeddingVector([0.9, 0.1, 0.0]))
        index.upsert(entryId: "far", vector: EmbeddingVector([0.0, 1.0, 0.0]))

        let result = index.topK(2, query: query)
        XCTAssertEqual(ids(result), ["near", "far"])
        XCTAssertGreaterThan(result[0].score, result[1].score)
    }

    func testScoresAreCosineValues() {
        var index = VectorIndex()
        index.upsert(entryId: "a", vector: EmbeddingVector([3, 4]))   // vs [4,3] → 0.96
        let result = index.topK(1, query: EmbeddingVector([4, 3]))
        XCTAssertEqual(result[0].score, 0.96, accuracy: 1e-6)
    }

    // MARK: - K bounds

    func testKGreaterThanCountReturnsAll() {
        var index = VectorIndex()
        index.upsert(entryId: "a", vector: EmbeddingVector([1, 0]))
        index.upsert(entryId: "b", vector: EmbeddingVector([0, 1]))
        XCTAssertEqual(index.topK(10, query: EmbeddingVector([1, 1])).count, 2)
    }

    func testKZeroOrNegativeReturnsEmpty() {
        var index = VectorIndex()
        index.upsert(entryId: "a", vector: EmbeddingVector([1, 0]))
        XCTAssertTrue(index.topK(0, query: EmbeddingVector([1, 0])).isEmpty)
        XCTAssertTrue(index.topK(-3, query: EmbeddingVector([1, 0])).isEmpty)
    }

    func testKLimitsCount() {
        var index = VectorIndex()
        for i in 0..<5 { index.upsert(entryId: "e\(i)", vector: EmbeddingVector([Float(i + 1), 1])) }
        XCTAssertEqual(index.topK(3, query: EmbeddingVector([1, 1])).count, 3)
    }

    func testEmptyIndexReturnsEmpty() {
        let index = VectorIndex()
        XCTAssertTrue(index.topK(5, query: EmbeddingVector([1, 0])).isEmpty)
    }

    // MARK: - Mutation

    func testUpsertOverwrites() {
        var index = VectorIndex()
        index.upsert(entryId: "a", vector: EmbeddingVector([0, 1]))  // orthogonal to query
        index.upsert(entryId: "a", vector: EmbeddingVector([1, 0]))  // now identical to query
        XCTAssertEqual(index.count, 1)
        let result = index.topK(1, query: EmbeddingVector([1, 0]))
        XCTAssertEqual(result[0].score, 1.0, accuracy: 1e-6)
    }

    func testRemoveDropsEntry() {
        var index = VectorIndex()
        index.upsert(entryId: "a", vector: EmbeddingVector([1, 0]))
        index.upsert(entryId: "b", vector: EmbeddingVector([0, 1]))
        index.remove(entryId: "a")
        XCTAssertEqual(index.count, 1)
        XCTAssertEqual(ids(index.topK(5, query: EmbeddingVector([1, 1]))), ["b"])
    }

    func testRemoveMissingIsNoOp() {
        var index = VectorIndex()
        index.upsert(entryId: "a", vector: EmbeddingVector([1, 0]))
        index.remove(entryId: "ghost")
        XCTAssertEqual(index.count, 1)
    }

    // MARK: - Determinism

    func testTieBreakIsDeterministicOnEntryId() {
        var index = VectorIndex()
        // All three are equally similar (identical direction) to the query, so the
        // ordering must fall back to ascending entryId, deterministically.
        index.upsert(entryId: "c", vector: EmbeddingVector([2, 0]))
        index.upsert(entryId: "a", vector: EmbeddingVector([3, 0]))
        index.upsert(entryId: "b", vector: EmbeddingVector([1, 0]))
        let result = index.topK(3, query: EmbeddingVector([1, 0]))
        XCTAssertEqual(ids(result), ["a", "b", "c"])
    }

    // MARK: - Fail-closed

    func testDimensionMismatchVectorsAreSkipped() {
        var index = VectorIndex()
        index.upsert(entryId: "match", vector: EmbeddingVector([1, 0, 0]))
        index.upsert(entryId: "wrongdim", vector: EmbeddingVector([1, 0]))  // 2-dim vs 3-dim query
        let result = index.topK(5, query: EmbeddingVector([1, 0, 0]))
        XCTAssertEqual(ids(result), ["match"])   // wrongdim contributes no bogus score
    }
}
