import Foundation

/// An in-memory map of `entryId -> EmbeddingVector` that answers brute-force
/// cosine top-K queries for client-side semantic search (increment 1c-D). Holding a
/// few thousand decrypted vectors and scanning them is sub-10ms, so no ANN index is
/// needed yet.
///
/// Pure and deterministic: no I/O, no crypto, no `Date()`, no global state. Ranking
/// is descending by cosine similarity with a stable tie-break on `entryId`, so the
/// same corpus and query always produce the same ordering.
///
/// Vectors whose dimension does not match the query are silently skipped (their
/// `cosineSimilarity` is `nil`) — they never contribute a bogus score.
struct VectorIndex {

    private var vectors: [String: EmbeddingVector] = [:]

    init() {}

    /// The number of indexed vectors.
    var count: Int { vectors.count }

    /// Insert or replace the vector for `entryId`.
    mutating func upsert(entryId: String, vector: EmbeddingVector) {
        vectors[entryId] = vector
    }

    /// Drop `entryId` from the index (no-op if absent).
    mutating func remove(entryId: String) {
        vectors.removeValue(forKey: entryId)
    }

    /// The top-`k` entries most similar to `query`, by cosine similarity, highest
    /// first. Ties (equal score) break on ascending `entryId` for deterministic
    /// output. `k <= 0` returns `[]`; `k` greater than the corpus returns everything.
    func topK(_ k: Int, query: EmbeddingVector) -> [(entryId: String, score: Float)] {
        guard k > 0 else { return [] }

        let scored: [(entryId: String, score: Float)] = vectors.compactMap { id, vector in
            guard let score = vector.cosineSimilarity(to: query) else { return nil }
            return (entryId: id, score: score)
        }

        let ranked = scored.sorted { lhs, rhs in
            if lhs.score != rhs.score { return lhs.score > rhs.score }
            return lhs.entryId < rhs.entryId
        }

        return Array(ranked.prefix(k))
    }

    /// Undirected top-`perNode` nearest-neighbour edges across the whole index,
    /// deduped, each with its cosine score. O(n²) — fine for a personal corpus
    /// (hundreds of entries). Used to build the journal similarity graph on-device.
    func neighbors(perNode: Int) -> [(source: String, target: String, score: Float)] {
        guard perNode > 0, vectors.count > 1 else { return [] }
        var seen = Set<String>()
        var edges: [(source: String, target: String, score: Float)] = []
        for (id, vector) in vectors {
            let top = vectors
                .compactMap { otherId, otherVec -> (String, Float)? in
                    guard otherId != id, let s = vector.cosineSimilarity(to: otherVec) else { return nil }
                    return (otherId, s)
                }
                .sorted { $0.1 > $1.1 }
                .prefix(perNode)
            for (otherId, score) in top {
                let key = id < otherId ? id + "|" + otherId : otherId + "|" + id
                if seen.contains(key) { continue }
                seen.insert(key)
                edges.append((source: id, target: otherId, score: score))
            }
        }
        return edges
    }
}
