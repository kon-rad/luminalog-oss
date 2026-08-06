import Foundation

/// Server-backed `SemanticIndexCoordinating`: chunks on-device (`JournalChunker`)
/// and delegates embedding + storage + search to the server (`RagService`). No
/// vectors are held on the client, and no embedding model is ever downloaded —
/// this is the only retrieval path. `search` returns deduped entry ids (best rank
/// first) for the entry-level consumers; `searchChunks` exposes the raw chunk
/// references for chunk-only RAG context assembly.
final class ServerSemanticIndex: SemanticIndexCoordinating {

    private let rag: RagServing

    init(rag: RagServing) { self.rag = rag }

    /// Days since the Unix epoch (UTC) for `date` — matches the server's
    /// `dateForDayIndex` so an entry's chunks land in the correct constellation day.
    static func dayIndex(for date: Date) -> Int {
        Int(floor(date.timeIntervalSince1970 / 86_400))
    }

    func indexEntry(id: String, text: String, createdAt: Date) async throws {
        let chunks = JournalChunker.chunks(of: text)
        let words = text.split { $0 == " " || $0 == "\n" || $0 == "\t" }.count
        try await rag.index(
            entryId: id, type: "text",
            dayIndex: Self.dayIndex(for: createdAt),
            wordCount: words, chunks: chunks
        )
    }

    func removeEntry(id: String) async throws {
        try await rag.delete(entryId: id)
    }

    /// One-time migration re-index: (re)index every entry with its real day. Sequential
    /// to respect provider rate limits; callers pass the full local corpus.
    func backfill(_ entries: [(id: String, text: String, createdAt: Date)]) async throws {
        for entry in entries {
            try await indexEntry(id: entry.id, text: entry.text, createdAt: entry.createdAt)
        }
    }

    func search(query: String, k: Int) async throws -> [String] {
        dedupedEntryIds(try await searchChunks(query: query, k: k))
    }

    /// Chunk-granular search for chunk-only RAG context assembly.
    func searchChunks(query: String, k: Int) async throws -> [ChunkRef] {
        try await rag.search(query: query, topK: k)
    }

    /// Deduplicate hits by entry id, preserving best-rank order (first occurrence wins).
    private func dedupedEntryIds(_ refs: [ChunkRef]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for ref in refs where !seen.contains(ref.entryId) {
            seen.insert(ref.entryId)
            out.append(ref.entryId)
        }
        return out
    }
}
