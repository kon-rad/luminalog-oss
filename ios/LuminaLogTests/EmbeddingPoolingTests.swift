import XCTest
@testable import LuminaLog

final class EmbeddingPoolingTests: XCTestCase {

    // MARK: - Known-fixture mean pooling

    func testMeanPoolOverAllTokensKnownVector() throws {
        // Three 2-dim tokens, all attended. Mean = ([1+3+5]/3, [1+3+5]/3) = (3, 3),
        // which normalizes to (1/√2, 1/√2).
        let tokens: [[Float]] = [[1, 1], [3, 3], [5, 5]]
        let mask = [1, 1, 1]
        let pooled = try XCTUnwrap(EmbeddingPooling.meanPool(tokenEmbeddings: tokens, attentionMask: mask))

        let inv = 1 / Float(2).squareRoot()
        XCTAssertEqual(pooled.values[0], inv, accuracy: 1e-6)
        XCTAssertEqual(pooled.values[1], inv, accuracy: 1e-6)
    }

    func testMaskedPositionsAreIgnored() throws {
        // The 3rd token is padding (mask 0) with a huge value that would wreck the
        // mean if counted. Real tokens: (2,0) and (0,2). Mean = (1,1) → (1/√2, 1/√2).
        let tokens: [[Float]] = [[2, 0], [0, 2], [1_000, 1_000]]
        let mask = [1, 1, 0]
        let pooled = try XCTUnwrap(EmbeddingPooling.meanPool(tokenEmbeddings: tokens, attentionMask: mask))

        let inv = 1 / Float(2).squareRoot()
        XCTAssertEqual(pooled.values[0], inv, accuracy: 1e-6)
        XCTAssertEqual(pooled.values[1], inv, accuracy: 1e-6)
    }

    func testOnlyUnmaskedTokenPassesThrough() throws {
        // A single attended token → its own direction (normalized). (3,4) → (0.6,0.8).
        let tokens: [[Float]] = [[3, 4], [100, 100]]
        let mask = [1, 0]
        let pooled = try XCTUnwrap(EmbeddingPooling.meanPool(tokenEmbeddings: tokens, attentionMask: mask))
        XCTAssertEqual(pooled.values[0], 0.6, accuracy: 1e-6)
        XCTAssertEqual(pooled.values[1], 0.8, accuracy: 1e-6)
    }

    // MARK: - Output is normalized

    func testOutputIsL2Normalized() throws {
        let tokens: [[Float]] = [[0.2, -0.5, 0.9, 1.3], [-0.7, 0.1, 0.4, -0.2], [0.05, 0.05, 0.05, 0.05]]
        let mask = [1, 1, 1]
        let pooled = try XCTUnwrap(EmbeddingPooling.meanPool(tokenEmbeddings: tokens, attentionMask: mask))
        XCTAssertEqual(pooled.magnitude, 1.0, accuracy: 1e-6)
    }

    // MARK: - Dimension / shape enforcement

    func testDimensionPreserved() throws {
        let tokens = [[Float](repeating: 0.5, count: 768), [Float](repeating: -0.25, count: 768)]
        let pooled = try XCTUnwrap(EmbeddingPooling.meanPool(tokenEmbeddings: tokens, attentionMask: [1, 1]))
        XCTAssertEqual(pooled.dimension, 768)
    }

    // MARK: - Fail-closed guards

    func testEmptyInputReturnsNil() {
        XCTAssertNil(EmbeddingPooling.meanPool(tokenEmbeddings: [], attentionMask: []))
    }

    func testMaskCountMismatchReturnsNil() {
        XCTAssertNil(EmbeddingPooling.meanPool(tokenEmbeddings: [[1, 2], [3, 4]], attentionMask: [1]))
    }

    func testRaggedRowsReturnNil() {
        XCTAssertNil(EmbeddingPooling.meanPool(tokenEmbeddings: [[1, 2], [3, 4, 5]], attentionMask: [1, 1]))
    }

    func testAllMaskedOutReturnsNil() {
        XCTAssertNil(EmbeddingPooling.meanPool(tokenEmbeddings: [[1, 2], [3, 4]], attentionMask: [0, 0]))
    }

    func testZeroWidthRowsReturnNil() {
        XCTAssertNil(EmbeddingPooling.meanPool(tokenEmbeddings: [[], []], attentionMask: [1, 1]))
    }

    func testDegenerateZeroMeanReturnsNil() {
        // Opposite tokens average to the zero vector, which has no direction → nil.
        XCTAssertNil(EmbeddingPooling.meanPool(tokenEmbeddings: [[1, 2], [-1, -2]], attentionMask: [1, 1]))
    }

    // MARK: - Flat/reshape overload

    func testFlatOverloadMatchesRowForm() throws {
        // flat [tokenCount=2, hiddenDim=3], row-major.
        let flat: [Float] = [1, 2, 3, 4, 5, 6]
        let viaFlat = try XCTUnwrap(EmbeddingPooling.meanPool(flat: flat, tokenCount: 2, hiddenDim: 3, attentionMask: [1, 1]))
        let viaRows = try XCTUnwrap(EmbeddingPooling.meanPool(tokenEmbeddings: [[1, 2, 3], [4, 5, 6]], attentionMask: [1, 1]))
        XCTAssertEqual(viaFlat, viaRows)
    }

    func testFlatOverloadWrongLengthReturnsNil() {
        XCTAssertNil(EmbeddingPooling.meanPool(flat: [1, 2, 3, 4, 5], tokenCount: 2, hiddenDim: 3, attentionMask: [1, 1]))
    }
}
