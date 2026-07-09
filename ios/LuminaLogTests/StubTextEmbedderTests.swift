import XCTest
@testable import LuminaLog

final class StubTextEmbedderTests: XCTestCase {

    func testDeterministicSameTextSameVector() async throws {
        let embedder = StubTextEmbedder()
        let a = try await embedder.embed("I felt calm walking by the river today.")
        let b = try await embedder.embed("I felt calm walking by the river today.")
        XCTAssertEqual(a, b)
    }

    func testDifferentTextDifferentVector() async throws {
        let embedder = StubTextEmbedder()
        let a = try await embedder.embed("gratitude and sunshine")
        let b = try await embedder.embed("anxiety and deadlines")
        XCTAssertNotEqual(a, b)
    }

    func testOutputDimensionMatchesModel() async throws {
        let v = try await StubTextEmbedder().embed("hello")
        XCTAssertEqual(v.dimension, EmbeddingVector.dimension)
        XCTAssertEqual(v.dimension, 512)
    }

    func testOutputIsL2Normalized() async throws {
        let v = try await StubTextEmbedder().embed("some journal text with several words")
        XCTAssertEqual(v.magnitude, 1.0, accuracy: 1e-5)
    }

    func testEmptyStringStillProducesNormalizedVector() async throws {
        // Even an empty input hashes to a stable, non-zero, normalized vector.
        let v = try await StubTextEmbedder().embed("")
        XCTAssertEqual(v.dimension, 512)
        XCTAssertEqual(v.magnitude, 1.0, accuracy: 1e-5)
    }

    func testCustomDimensionHonored() async throws {
        let v = try await StubTextEmbedder(dimension: 16).embed("tiny")
        XCTAssertEqual(v.dimension, 16)
        XCTAssertEqual(v.magnitude, 1.0, accuracy: 1e-5)
    }

    func testBatchMatchesIndividualEmbeds() async throws {
        let embedder = StubTextEmbedder()
        let texts = ["one", "two", "three"]
        let batch = try await embedder.embed(batch: texts)
        XCTAssertEqual(batch.count, 3)
        for (i, text) in texts.enumerated() {
            let single = try await embedder.embed(text)
            XCTAssertEqual(batch[i], single)
        }
    }

    func testConformsToTextEmbedder() async throws {
        // Used through the protocol so the pipeline can depend on the abstraction.
        let embedder: TextEmbedder = StubTextEmbedder()
        let v = try await embedder.embed("via protocol")
        XCTAssertEqual(v.dimension, 512)
    }
}
