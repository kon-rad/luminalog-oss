import Foundation

/// Pure pooling math that turns a transformer's per-token hidden states into a single
/// sentence embedding. This is the step that MUST match the web (Transformers.js) and
/// Android references bit-for-bit-ish (cosine > 0.999) for cross-platform vector
/// parity (increment 1c-D, Phase 0 parity gate), so it lives in its own fully
/// unit-tested, side-effect-free type.
///
/// The recipe (identical to Sentence-Transformers mean pooling):
///   1. Mask out padding tokens using the attention mask.
///   2. Sum the remaining token vectors component-wise and divide by the number of
///      unmasked tokens (mean pooling).
///   3. L2-normalize the result.
///
/// Fails **closed**: any shape inconsistency, an empty sequence, a mask that zeroes
/// out every token, or a non-finite result yields `nil` — never a bogus vector.
enum EmbeddingPooling {

    /// Mean-pool `tokenEmbeddings` (one `[Float]` per token, each of equal hidden
    /// dimension) using `attentionMask` (1 = real token, 0 = padding), then
    /// L2-normalize.
    ///
    /// - Returns: a normalized `EmbeddingVector`, or `nil` if the inputs are
    ///   inconsistent (`tokenEmbeddings.count != attentionMask.count`, empty input,
    ///   ragged rows, all-zero mask, or a non-finite component).
    static func meanPool(tokenEmbeddings: [[Float]], attentionMask: [Int]) -> EmbeddingVector? {
        guard !tokenEmbeddings.isEmpty,
              tokenEmbeddings.count == attentionMask.count else { return nil }

        let hiddenDim = tokenEmbeddings[0].count
        guard hiddenDim > 0 else { return nil }

        var sums = [Float](repeating: 0, count: hiddenDim)
        var included = 0

        for (row, mask) in zip(tokenEmbeddings, attentionMask) {
            guard row.count == hiddenDim else { return nil }   // ragged → fail closed
            guard mask != 0 else { continue }                  // padding → skip
            included += 1
            for i in 0..<hiddenDim {
                sums[i] += row[i]
            }
        }

        guard included > 0 else { return nil }   // every token masked out

        let denom = Float(included)
        var mean = [Float](repeating: 0, count: hiddenDim)
        for i in 0..<hiddenDim {
            let v = sums[i] / denom
            guard v.isFinite else { return nil }
            mean[i] = v
        }

        let pooled = EmbeddingVector(mean).l2normalized
        // A degenerate all-zero mean cannot be normalized to unit length; reject it so
        // callers never index a direction-less vector.
        guard pooled.magnitude > 0 else { return nil }
        return pooled
    }

    /// Convenience overload for runtimes that hand back a flat `[Float]` buffer plus a
    /// `[tokenCount, hiddenDim]` shape (row-major), which is how an ORT tensor reads
    /// out. Reshapes then delegates to `meanPool(tokenEmbeddings:attentionMask:)`.
    ///
    /// - Returns: `nil` if `flat.count != tokenCount * hiddenDim` or the reshaped
    ///   inputs are otherwise inconsistent.
    static func meanPool(
        flat: [Float],
        tokenCount: Int,
        hiddenDim: Int,
        attentionMask: [Int]
    ) -> EmbeddingVector? {
        guard tokenCount > 0, hiddenDim > 0,
              flat.count == tokenCount * hiddenDim else { return nil }

        var rows = [[Float]]()
        rows.reserveCapacity(tokenCount)
        for t in 0..<tokenCount {
            let start = t * hiddenDim
            rows.append(Array(flat[start..<(start + hiddenDim)]))
        }
        return meanPool(tokenEmbeddings: rows, attentionMask: attentionMask)
    }
}
