import Foundation

/// Builds the anchored constellation point-set from journal entries, fully on-device.
/// Gates on the daily word target, forms each qualifying day's centroid, and projects
/// onto the pinned axes. Reuses an already-computed embedding (via `vectorProvider`,
/// e.g. the semantic index's cache) when available, falling back to embedding the
/// text on a miss — so an entry is embedded at most once.
final class ConstellationBuilder {
    private let embedder: TextEmbedder
    private let wordTarget: Int
    private let vectorProvider: (String) -> EmbeddingVector?

    init(embedder: TextEmbedder, wordTarget: Int = 750,
         vectorProvider: @escaping (String) -> EmbeddingVector? = { _ in nil }) {
        self.embedder = embedder
        self.wordTarget = wordTarget
        self.vectorProvider = vectorProvider
    }

    func build(entries: [(id: String, text: String, wordCount: Int, createdAt: Date)]) async throws -> [ConstellationPoint] {
        let buckets = DayBucketing.bucket(entries: entries).filter { $0.wordTotal >= wordTarget }
        let streaks = DayBucketing.streaks(sortedQualifyingDayIndices: buckets.map { $0.dayIndex })

        var points: [ConstellationPoint] = []
        for bucket in buckets {
            let centroid = try await meanCentroid(of: bucket.entries)
            let p = AnchoredProjection.project(centroid)
            points.append(ConstellationPoint(
                dayIndex: bucket.dayIndex,
                date: bucket.date,
                x: p.x, y: p.y, z: p.z,
                wordCount: bucket.wordTotal,
                streakAtEarn: streaks[bucket.dayIndex] ?? 1))
        }
        return points
    }

    /// Mean of per-entry L2-normalized embeddings (equal weight per entry; no
    /// renormalization of the mean), consistent with the on-device
    /// `SemanticIndexCoordinator`, which also embeds whole entries. Reuses a cached
    /// vector from `vectorProvider` when present (identical result — same embedder),
    /// else embeds the text. This does not match the server's chunk-weighted
    /// `computeDayCentroid` — the on-device constellation is its own canonical space.
    private func meanCentroid(of entries: [(id: String, text: String)]) async throws -> [Float] {
        let dim = EmbeddingVector.dimension
        var sum = [Float](repeating: 0, count: dim)
        var n = 0
        for e in entries {
            let vec: EmbeddingVector
            if let cached = vectorProvider(e.id) {
                vec = cached
            } else {
                vec = try await embedder.embed(e.text)
            }
            let v = vec.values
            guard v.count == dim else { continue }
            for i in 0..<dim { sum[i] += v[i] }
            n += 1
        }
        guard n > 0 else { return sum }
        for i in 0..<dim { sum[i] /= Float(n) }
        return sum
    }
}
