import Foundation
import CryptoKit

/// A deterministic, ML-free `TextEmbedder` that derives a stable pseudo-embedding
/// from a SHA-256 of the input. It is **not** semantic — cosine distances are
/// meaningless — but it is fully reproducible (same text → same vector, different
/// text → different vector), correctly shaped (768-dim, L2-normalized), and needs no
/// model download. That lets the entire client-side RAG pipeline (`VectorIndex`,
/// `EncryptedVectorStore`, retrieval wiring) be built and tested before the real
/// EmbeddingGemma ONNX model is hosted (increment 1c-D).
///
/// Pure and side-effect-free: no I/O, no global state, no `Date()`.
struct StubTextEmbedder: TextEmbedder {

    /// Output dimension. Defaults to the shipping model's 768 so the stub is a
    /// drop-in for the real embedder.
    let dimension: Int

    init(dimension: Int = EmbeddingVector.dimension) {
        self.dimension = dimension
    }

    func embed(_ text: String) async throws -> EmbeddingVector {
        EmbeddingVector(Self.deterministicComponents(for: text, count: dimension)).l2normalized
    }

    // MARK: - Deterministic component generation

    /// Produce `count` deterministic Float components in `[-1, 1)` seeded from the
    /// text. Uses SHA-256 in counter mode (hash of `text || blockIndex`) as a
    /// deterministic byte stream — the same construction on any platform yields the
    /// same bytes, and each byte maps to a signed Float so the vector has a spread of
    /// signs (never degenerately all-positive → never zero magnitude for non-empty
    /// output).
    static func deterministicComponents(for text: String, count: Int) -> [Float] {
        guard count > 0 else { return [] }

        var out = [Float]()
        out.reserveCapacity(count)

        let textBytes = Array(text.utf8)
        var block = 0
        while out.count < count {
            var hasher = SHA256()
            hasher.update(data: Data(textBytes))
            var counter = UInt32(block).littleEndian
            withUnsafeBytes(of: &counter) { hasher.update(data: Data($0)) }
            let digest = hasher.finalize()   // 32 bytes

            for byte in digest {
                if out.count >= count { break }
                // Map 0...255 → [-1, 1): (byte / 127.5) - 1.0
                out.append(Float(byte) / 127.5 - 1.0)
            }
            block += 1
        }
        return out
    }
}
