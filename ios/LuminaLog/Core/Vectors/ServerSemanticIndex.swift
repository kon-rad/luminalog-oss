import Foundation

/// Server-backed `SemanticIndexCoordinating`: chunks on-device (`JournalChunker`)
/// and delegates embedding + storage + search to the server (`RagService`). No
/// vectors are held on the client. `search` returns deduped entry ids (best rank
/// first) for the existing entry-level consumers; `searchChunks` exposes the raw
/// chunk references for chunk-only RAG context assembly.
///
/// This coexists with the on-device `SemanticIndexCoordinator`; `AppServices`
/// selects which one to build based on `DevFlags.serverRag`.
final class ServerSemanticIndex: SemanticIndexCoordinating {

    private let rag: RagServing

    init(rag: RagServing) { self.rag = rag }

    func indexEntry(id: String, text: String) async throws {
        let chunks = JournalChunker.chunks(of: text)
        let words = text.split { $0 == " " || $0 == "\n" || $0 == "\t" }.count
        try await rag.index(entryId: id, type: "text", dayIndex: 0, wordCount: words, chunks: chunks)
    }

    func removeEntry(id: String) async throws {
        try await rag.delete(entryId: id)
    }

    /// Server holds the index — nothing to load/prime on the client.
    func loadIndex() async throws {}

    /// One-user / cold-start re-index: (re)index every entry. Sequential to respect
    /// provider rate limits; callers pass the full corpus.
    func backfill(_ entries: [(id: String, text: String)]) async throws {
        for entry in entries {
            try await indexEntry(id: entry.id, text: entry.text)
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
