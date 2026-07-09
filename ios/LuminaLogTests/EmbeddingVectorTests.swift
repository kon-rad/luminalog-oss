import XCTest
@testable import LuminaLog

final class EmbeddingVectorTests: XCTestCase {

    // MARK: - Cosine similarity

    func testIdenticalVectorsSimilarityIsOne() {
        let v = EmbeddingVector([1, 2, 3, 4])
        let score = try? XCTUnwrap(v.cosineSimilarity(to: v))
        XCTAssertEqual(score ?? 0, 1.0, accuracy: 1e-5)
    }

    func testOrthogonalVectorsSimilarityIsZero() {
        let a = EmbeddingVector([1, 0])
        let b = EmbeddingVector([0, 1])
        XCTAssertEqual(a.cosineSimilarity(to: b) ?? .nan, 0.0, accuracy: 1e-6)
    }

    func testKnownSmallVectorsHaveKnownSimilarity() {
        // dot = 3*4 + 4*3 = 24 ; |a| = |b| = 5 ; cosine = 24 / 25 = 0.96
        let a = EmbeddingVector([3, 4])
        let b = EmbeddingVector([4, 3])
        XCTAssertEqual(a.cosineSimilarity(to: b) ?? .nan, 0.96, accuracy: 1e-6)
    }

    func testOppositeVectorsSimilarityIsMinusOne() {
        let a = EmbeddingVector([1, 2, 3])
        let b = EmbeddingVector([-1, -2, -3])
        XCTAssertEqual(a.cosineSimilarity(to: b) ?? .nan, -1.0, accuracy: 1e-5)
    }

    // MARK: - Fail-closed guards

    func testDimensionMismatchReturnsNil() {
        let a = EmbeddingVector([1, 2, 3])
        let b = EmbeddingVector([1, 2])
        XCTAssertNil(a.cosineSimilarity(to: b))
    }

    func testEmptyVectorReturnsNil() {
        let a = EmbeddingVector([])
        let b = EmbeddingVector([])
        XCTAssertNil(a.cosineSimilarity(to: b))
    }

    func testZeroMagnitudeReturnsNil() {
        let zero = EmbeddingVector([0, 0, 0])
        let v = EmbeddingVector([1, 2, 3])
        XCTAssertNil(zero.cosineSimilarity(to: v))
        XCTAssertNil(v.cosineSimilarity(to: zero))
    }

    // MARK: - Normalization

    func testL2NormalizedHasUnitMagnitude() {
        let v = EmbeddingVector([3, 4]).l2normalized
        XCTAssertEqual(v.magnitude, 1.0, accuracy: 1e-6)
        XCTAssertEqual(v.values[0], 0.6, accuracy: 1e-6)
        XCTAssertEqual(v.values[1], 0.8, accuracy: 1e-6)
    }

    func testL2NormalizedZeroVectorIsUnchanged() {
        let zero = EmbeddingVector([0, 0, 0])
        XCTAssertEqual(zero.l2normalized, zero)
    }

    // MARK: - Data serialization

    func testDataRoundTripExact() {
        // Representative values: zero, small, negative, large, fractional.
        let v = EmbeddingVector([0, 1, -1, 3.14159, -2.71828, 1_000_000.5, -0.0000123, Float.greatestFiniteMagnitude])
        let decoded = EmbeddingVector(data: v.data)
        XCTAssertEqual(decoded, v)   // bit-for-bit (Float == over identical bit patterns)
    }

    func testDataByteCountIsFourPerComponent() {
        let v = EmbeddingVector([1, 2, 3, 4, 5])
        XCTAssertEqual(v.data.count, 5 * 4)
    }

    func testDataIsLittleEndian() {
        // 1.0f == 0x3F800000. Little-endian bytes: 00 00 80 3F.
        let v = EmbeddingVector([1.0])
        XCTAssertEqual([UInt8](v.data), [0x00, 0x00, 0x80, 0x3F])
    }

    func testEmptyVectorSerializesToEmptyDataAndBack() {
        let v = EmbeddingVector([])
        XCTAssertEqual(v.data.count, 0)
        XCTAssertEqual(EmbeddingVector(data: v.data), v)
    }

    func testMisalignedDataFailsToDecode() {
        // 5 bytes is not a whole number of 4-byte floats → nil (fail closed).
        XCTAssertNil(EmbeddingVector(data: Data([0x00, 0x00, 0x80, 0x3F, 0x01])))
    }

    func testFullDimensionRoundTrips() {
        let values = (0..<EmbeddingVector.dimension).map { Float($0) * 0.001 - 0.3 }
        let v = EmbeddingVector(values)
        XCTAssertEqual(v.dimension, 512)
        XCTAssertEqual(EmbeddingVector(data: v.data), v)
    }
}
