import Foundation

/// A dense embedding as a value type over `[Float]`. On-device, journal text is
/// embedded into a fixed-dimension vector (the embedding *model* is a separate
/// increment — this type assumes the vector is given) for zero-knowledge,
/// client-side semantic search (increment 1c-D).
///
/// Pure value: no I/O, no crypto, no global state. Provides the two operations the
/// index needs — `l2normalized` and `cosineSimilarity(to:)` — plus a compact,
/// host-independent little-endian `Data` serialization so the raw bytes can be
/// sealed under the user's DEK by `EncryptedVectorStore`.
///
/// Everything fails **closed**: dimension mismatches yield `nil`, never a bogus
/// score, and malformed byte buffers refuse to decode.
struct EmbeddingVector: Equatable {

    /// The canonical embedding dimension for the shipping model
    /// (paraphrase-multilingual-MiniLM-L12-v2, 384-dim). Tests and the store may use
    /// other dimensions; this is only the default the `EncryptedVectorStore` validates
    /// against. Locks once any real vector is written — do not change after launch.
    static let dimension = 384

    /// The raw component values. Length is the vector's dimension.
    let values: [Float]

    /// The vector's dimension (component count).
    var dimension: Int { values.count }

    init(_ values: [Float]) {
        self.values = values
    }

    // MARK: - Similarity

    /// The Euclidean (L2) magnitude of the vector.
    var magnitude: Float {
        var sum: Float = 0
        for v in values { sum += v * v }
        return sum.squareRoot()
    }

    /// A unit-length copy of this vector. A zero (or empty) vector has no defined
    /// direction, so it is returned unchanged rather than producing NaNs.
    var l2normalized: EmbeddingVector {
        let mag = magnitude
        guard mag > 0 else { return self }
        return EmbeddingVector(values.map { $0 / mag })
    }

    /// Cosine similarity to `other`: the dot product of the two L2-normalized
    /// vectors, in `[-1, 1]`. Fails closed — returns `nil` on a dimension mismatch,
    /// on an empty vector, or when either vector has zero magnitude (direction
    /// undefined) — so a caller can never mistake a degenerate case for a real score.
    func cosineSimilarity(to other: EmbeddingVector) -> Float? {
        guard dimension == other.dimension, dimension > 0 else { return nil }

        var dot: Float = 0
        var magA: Float = 0
        var magB: Float = 0
        for i in values.indices {
            let a = values[i]
            let b = other.values[i]
            dot += a * b
            magA += a * a
            magB += b * b
        }
        guard magA > 0, magB > 0 else { return nil }
        return dot / (magA.squareRoot() * magB.squareRoot())
    }

    // MARK: - Serialization

    /// The components as little-endian IEEE-754 `Float32` bytes (4 bytes each),
    /// host-independent. This is the plaintext that `EncryptedVectorStore` seals.
    var data: Data {
        var bytes = [UInt8]()
        bytes.reserveCapacity(values.count * 4)
        for v in values {
            let u = v.bitPattern            // native UInt32 bit pattern
            bytes.append(UInt8(u & 0xFF))          // least-significant byte first
            bytes.append(UInt8((u >> 8) & 0xFF))
            bytes.append(UInt8((u >> 16) & 0xFF))
            bytes.append(UInt8((u >> 24) & 0xFF))
        }
        return Data(bytes)
    }

    /// Reconstruct a vector from little-endian `Float32` bytes produced by `data`.
    /// Returns `nil` if the buffer length is not a whole number of 4-byte floats —
    /// a fail-closed guard against truncated or corrupt blobs.
    init?(data: Data) {
        guard data.count % 4 == 0 else { return nil }
        var out = [Float]()
        out.reserveCapacity(data.count / 4)
        var i = data.startIndex
        while i < data.endIndex {
            let b0 = UInt32(data[i])
            let b1 = UInt32(data[i + 1])
            let b2 = UInt32(data[i + 2])
            let b3 = UInt32(data[i + 3])
            let u = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
            out.append(Float(bitPattern: u))
            i += 4
        }
        self.values = out
    }
}
