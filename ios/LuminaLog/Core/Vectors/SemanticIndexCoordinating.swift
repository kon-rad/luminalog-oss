import Foundation

/// The client's seam over server-side semantic RAG. Chunking happens on-device
/// (`JournalChunker`); embedding, storage, and search all live on the server
/// (`/v1/rag/*`) — the client never holds a model or a vector. `ServerSemanticIndex`
/// is the sole production conformer; tests use a fake.
///
/// Zero-knowledge: `indexEntry`/`backfill` ship PLAINTEXT chunks that the server
/// embeds transiently and discards (only vectors + metadata persist). `createdAt`
/// is passed so the server can bucket an entry's chunks by day (the Soul
/// Constellation groups ≥750-word days).
protocol SemanticIndexCoordinating: AnyObject {
    /// Chunk + ship `text` for server-side (re)indexing under `id`. `createdAt`
    /// determines the entry's day bucket.
    func indexEntry(id: String, text: String, createdAt: Date) async throws
    /// Remove `id`'s chunks from the server (idempotent).
    func removeEntry(id: String) async throws
    /// (Re)index a batch of entries — used for the one-time server migration of a
    /// corpus that predates server RAG. Sequential to respect provider rate limits.
    func backfill(_ entries: [(id: String, text: String, createdAt: Date)]) async throws
    /// Top-`k` entry ids by similarity to `query` (deduped from chunk hits).
    func search(query: String, k: Int) async throws -> [String]
    /// Chunk-granular search for chunk-only RAG context assembly.
    func searchChunks(query: String, k: Int) async throws -> [ChunkRef]
}

extension SemanticIndexCoordinating {
    /// Default: one ref per matched entry id (chunkIndex 0). `ServerSemanticIndex`
    /// overrides with real chunk references; test fakes can rely on this.
    func searchChunks(query: String, k: Int) async throws -> [ChunkRef] {
        try await search(query: query, k: k).map { ChunkRef(entryId: $0, chunkIndex: 0, score: 0) }
    }
}
