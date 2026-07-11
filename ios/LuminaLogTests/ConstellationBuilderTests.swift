import XCTest
@testable import LuminaLog

/// Deterministic fake: embeds "V"→valence axis, "I"→inward axis, else zeros.
private final class FakeEmbedder: TextEmbedder {
    func embed(_ text: String) async throws -> EmbeddingVector {
        if text == "V" { return EmbeddingVector(AnchorConstants.axes[0].map { Float($0) }) }
        if text == "I" { return EmbeddingVector(AnchorConstants.axes[1].map { Float($0) }) }
        return EmbeddingVector([Float](repeating: 0, count: 512))
    }
}

/// Always embeds zeros — used to prove a PROVIDED vector was reused, not embedded.
private final class ZeroEmbedder: TextEmbedder {
    func embed(_ text: String) async throws -> EmbeddingVector {
        EmbeddingVector([Float](repeating: 0, count: 512))
    }
}

final class ConstellationBuilderTests: XCTestCase {
    private func d(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    func testOnlyDaysAtOrAboveWordTargetBecomeStars() async throws {
        let b = ConstellationBuilder(embedder: FakeEmbedder())
        let pts = try await b.build(entries: [
            (id: "a", text: "V", wordCount: 800, createdAt: d("2024-10-04T08:00:00Z")), // qualifies
            (id: "b", text: "V", wordCount: 300, createdAt: d("2024-10-05T08:00:00Z")), // below 750
        ])
        XCTAssertEqual(pts.count, 1)
        XCTAssertEqual(pts[0].dayIndex, 20000)
        XCTAssertEqual(pts[0].wordCount, 800)
        XCTAssertEqual(pts[0].x, 0.99984463, accuracy: 1e-5) // valence-axis golden
    }

    func testMultipleEntriesInADayAreAveragedThenProjected() async throws {
        let b = ConstellationBuilder(embedder: FakeEmbedder())
        // "V" + zeros -> centroid = 0.5*valence; still qualifies (400+400 words)
        let pts = try await b.build(entries: [
            (id: "a", text: "V", wordCount: 400, createdAt: d("2024-10-04T08:00:00Z")),
            (id: "b", text: "zzz", wordCount: 400, createdAt: d("2024-10-04T09:00:00Z")),
        ])
        XCTAssertEqual(pts.count, 1)
        // tanh(gain*0.5) < tanh(gain*1): halfway centroid pulls x below the full-axis golden
        XCTAssertLessThan(pts[0].x, 0.99984463)
        XCTAssertGreaterThan(pts[0].x, 0.9)
    }

    func testPointsSortedByDayWithStreaks() async throws {
        let b = ConstellationBuilder(embedder: FakeEmbedder())
        let pts = try await b.build(entries: [
            (id: "a", text: "V", wordCount: 800, createdAt: d("2024-10-04T08:00:00Z")), // day 20000
            (id: "b", text: "I", wordCount: 800, createdAt: d("2024-10-05T08:00:00Z")), // day 20001
        ])
        XCTAssertEqual(pts.map { $0.dayIndex }, [20000, 20001])
        XCTAssertEqual(pts[0].streakAtEarn, 1)
        XCTAssertEqual(pts[1].streakAtEarn, 2)
    }

    /// The provider returns the valence axis for "a" while the embedder returns
    /// zeros; a valence-golden x proves the PROVIDED (cached) vector was used and
    /// the text was never embedded.
    func testReusesProvidedVectorInsteadOfEmbedding() async throws {
        let provided = EmbeddingVector(AnchorConstants.axes[0].map { Float($0) })
        let b = ConstellationBuilder(embedder: ZeroEmbedder(),
                                     vectorProvider: { $0 == "a" ? provided : nil })
        let pts = try await b.build(entries: [
            (id: "a", text: "ignored", wordCount: 800, createdAt: d("2024-10-04T08:00:00Z")),
        ])
        XCTAssertEqual(pts.count, 1)
        XCTAssertEqual(pts[0].x, 0.99984463, accuracy: 1e-5)
    }
}
