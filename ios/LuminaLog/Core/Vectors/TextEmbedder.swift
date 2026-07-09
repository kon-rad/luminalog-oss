import Foundation

/// Errors an embedder can surface. Everything fails **closed**: an embedder that
/// cannot produce a real vector throws rather than returning a bogus one.
enum TextEmbedderError: LocalizedError, Equatable {
    /// The embedder is a placeholder that cannot run yet (e.g. the real ONNX model
    /// is not hosted/wired). Used by the `ONNXTextEmbedder` scaffold.
    case notImplemented
    /// The model and/or tokenizer files are missing on disk (nothing downloaded).
    case modelUnavailable
    /// The tokenizer produced no usable tokens for the input.
    case tokenizationFailed
    /// The ML runtime failed to produce token embeddings.
    case inferenceFailed(String)
    /// Pooling could not produce a valid vector (shape/mask mismatch, all-masked).
    case poolingFailed

    var errorDescription: String? {
        switch self {
        case .notImplemented:
            return "The on-device embedding model is not available in this build yet."
        case .modelUnavailable:
            return "The embedding model files have not been downloaded."
        case .tokenizationFailed:
            return "Could not tokenize the input text."
        case .inferenceFailed(let detail):
            return "On-device embedding inference failed: \(detail)"
        case .poolingFailed:
            return "Could not pool token embeddings into a vector."
        }
    }
}

/// Abstraction over "turn text into a fixed-dimension `EmbeddingVector`". The real
/// implementation runs distiluse via ONNX Runtime (`ONNXTextEmbedder`); the
/// deterministic `StubTextEmbedder` lets the whole client-side semantic-search
/// pipeline (increment 1c-D) be built and unit-tested *before* the ~100–200 MB model
/// is hosted.
///
/// The returned vector is expected to be L2-normalized and of
/// `EmbeddingVector.dimension` (512), so callers can feed it straight into
/// `VectorIndex` / `EncryptedVectorStore`.
protocol TextEmbedder {
    /// Embed a single string into a normalized 512-dim vector.
    func embed(_ text: String) async throws -> EmbeddingVector

    /// Embed several strings, preserving order. The default implementation maps
    /// `embed(_:)` over the batch; conformers with a real runtime may override to
    /// run a batched session for throughput.
    func embed(batch texts: [String]) async throws -> [EmbeddingVector]
}

extension TextEmbedder {
    func embed(batch texts: [String]) async throws -> [EmbeddingVector] {
        var out: [EmbeddingVector] = []
        out.reserveCapacity(texts.count)
        for text in texts {
            out.append(try await embed(text))
        }
        return out
    }
}
