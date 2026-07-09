import XCTest
@testable import LuminaLog

final class ONNXTextEmbedderTests: XCTestCase {

    /// With no model file on disk, the embedder must fail closed with a clear error
    /// rather than crashing or fabricating a vector.
    func testMissingModelThrowsModelUnavailable() async {
        let missing = FileManager.default.temporaryDirectory
            .appendingPathComponent("does-not-exist-\(UUID().uuidString).onnx")
        let embedder = ONNXTextEmbedder(modelURL: missing, tokenizerDirectory: missing.deletingLastPathComponent())

        do {
            _ = try await embedder.embed("anything")
            XCTFail("expected a thrown error when the model is absent")
        } catch let error as TextEmbedderError {
            XCTAssertEqual(error, .modelUnavailable)
        } catch {
            XCTFail("unexpected error type: \(error)")
        }
    }

    /// The ORT runtime + tokenizer ARE linked, but there is no hosted model. With a
    /// present-but-bogus model file and an empty tokenizer directory, the real
    /// pipeline must fail closed with a clear `TextEmbedderError` (tokenizer load
    /// fails before any inference) — never a crash and never a fabricated vector.
    func testPresentModelWithMissingTokenizerFailsClosed() async throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("onnx-embedder-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        let modelURL = dir.appendingPathComponent("model.onnx")
        try Data("not a real onnx model".utf8).write(to: modelURL)

        let embedder = ONNXTextEmbedder(modelURL: modelURL, tokenizerDirectory: dir)
        do {
            _ = try await embedder.embed("hello")
            XCTFail("expected a thrown TextEmbedderError with no real model/tokenizer")
        } catch let error as TextEmbedderError {
            // Tokenizer config is absent → tokenizationFailed (fail closed).
            XCTAssertEqual(error, .tokenizationFailed)
        }
    }

    // MARK: - Pure output-pooling helper (testable without a model)

    func testPoolRank3MeanPools() throws {
        // [1, seq=2, hidden=2] flat, both tokens attended → mean then normalize.
        let v = try ONNXTextEmbedder.pool(floats: [2, 0, 0, 2], shape: [1, 2, 2], attentionMask: [1, 1])
        let inv = 1 / Float(2).squareRoot()
        XCTAssertEqual(v.values[0], inv, accuracy: 1e-6)
        XCTAssertEqual(v.values[1], inv, accuracy: 1e-6)
    }

    func testPoolRank2NormalizesDirectly() throws {
        // [1, hidden=2] already-pooled sentence embedding → just normalized.
        let v = try ONNXTextEmbedder.pool(floats: [3, 4], shape: [1, 2], attentionMask: [1])
        XCTAssertEqual(v.values[0], 0.6, accuracy: 1e-6)
        XCTAssertEqual(v.values[1], 0.8, accuracy: 1e-6)
    }

    func testPoolUnexpectedRankThrows() {
        XCTAssertThrowsError(try ONNXTextEmbedder.pool(floats: [1, 2, 3, 4], shape: [2, 2, 2, 2], attentionMask: [1, 1]))
    }

    func testInt64DataIsLittleEndian() {
        // 1 → 8 bytes, 01 00 00 00 00 00 00 00.
        XCTAssertEqual([UInt8](ONNXTextEmbedder.int64Data([1])),
                       [0x01, 0, 0, 0, 0, 0, 0, 0])
    }

    func testFloatsRoundTripFromLittleEndianBytes() {
        // 1.0f == 0x3F800000 little-endian: 00 00 80 3F.
        XCTAssertEqual(ONNXTextEmbedder.floats(from: Data([0x00, 0x00, 0x80, 0x3F])), [1.0])
    }

    func testConformsToTextEmbedder() {
        let embedder: TextEmbedder = ONNXTextEmbedder(
            modelURL: URL(fileURLWithPath: "/tmp/m.onnx"),
            tokenizerDirectory: URL(fileURLWithPath: "/tmp")
        )
        XCTAssertNotNil(embedder)
    }
}
