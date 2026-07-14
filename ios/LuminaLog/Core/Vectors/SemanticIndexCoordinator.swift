import Foundation
import CryptoKit

/// Errors surfaced by `SemanticIndexCoordinator`. Fails **closed**: without a DEK
/// no vector can be sealed or opened, so we throw rather than fall back to plaintext.
enum SemanticIndexError: LocalizedError {
    case keyUnavailable

    var errorDescription: String? {
        switch self {
        case .keyUnavailable:
            return "The encryption key is not available to index or load vectors."
        }
    }
}

/// Narrow protocol over the coordinator's live-path operations, so the two 19b
/// call sites — semantic retrieval (`Model1Requests.journalContext`) and the
/// lifecycle decorator (`IndexingJournalRepository`) — depend on an abstraction
/// and stay unit-testable with a fake (no ML, no network). `SemanticIndexCoordinator`
/// is the only production conformer.
protocol SemanticIndexCoordinating: AnyObject {
    /// Embed + seal + sync + index `text` under `id`.
    func indexEntry(id: String, text: String) async throws
    /// Remove `id` from the server and the in-memory index.
    func removeEntry(id: String) async throws
    /// Populate the in-memory index from synced blobs (idempotent).
    func loadIndex() async throws
    /// Index only the entries not already present (batched, no-op when none missing).
    func backfill(_ entries: [(id: String, text: String)]) async throws
    /// Top-`k` entry ids by cosine similarity to `query`; `[]` for an empty index.
    func search(query: String, k: Int) async throws -> [String]
    /// Chunk-granular search for chunk-only RAG context. The default derives one ref
    /// per entry id from `search` (chunkIndex 0), so on-device conformers need not
    /// change; the server-backed conformer overrides it with real chunk references.
    func searchChunks(query: String, k: Int) async throws -> [ChunkRef]
    /// The cached on-device embedding for an indexed entry, or nil if absent
    /// (not yet indexed / index not loaded). Callers must tolerate nil.
    func vector(for id: String) -> EmbeddingVector?
    /// Undirected top-`neighborsPerNode` similarity edges across the whole index, for
    /// the on-device journal graph. Default impl returns `[]` so test fakes need not
    /// implement it.
    func similarityGraph(neighborsPerNode: Int) async throws -> [(source: String, target: String, score: Double)]
}

extension SemanticIndexCoordinating {
    func similarityGraph(neighborsPerNode: Int) async throws -> [(source: String, target: String, score: Double)] { [] }
    /// Default: no cache. Real coordinator overrides; test fakes need not implement it.
    func vector(for id: String) -> EmbeddingVector? { nil }
    /// Default: one ref per matched entry id (chunkIndex 0). The server-backed
    /// conformer overrides with real chunk references.
    func searchChunks(query: String, k: Int) async throws -> [ChunkRef] {
        try await search(query: query, k: k).map { ChunkRef(entryId: $0, chunkIndex: 0, score: 0) }
    }
}

/// Orchestrates the client-side, zero-knowledge semantic-search pipeline
/// (increment 1c-D): text → embedding → DEK-sealed blob → server sync, and the
/// reverse on load, plus the in-memory `VectorIndex` that answers top-K queries.
///
/// Every collaborator is injected so this is pure orchestration and fully unit
/// testable with a deterministic `StubTextEmbedder` and a fake `VectorSyncService`
/// (no ML, no network). It is **not** wired into any live path yet — 19b does that.
///
/// The DEK is supplied by a closure (rather than captured up front) because it is
/// loaded asynchronously after sign-in via `UserKeyStore.currentDataKey`; the
/// closure returns `nil` until then, which makes the seal/open paths fail closed.
final class SemanticIndexCoordinator {

    private let embedder: TextEmbedder
    private let store: EncryptedVectorStore
    private let service: VectorSyncService
    private let dek: () -> SymmetricKey?
    private let model: String

    /// In-memory brute-force index (value type — held as mutable class state).
    private var index: VectorIndex
    /// Ids currently present in `index`. Tracked alongside the index because
    /// `VectorIndex` (deliberately) exposes no membership query, and `backfill`
    /// needs to skip already-indexed entries without touching that type.
    private var indexedIds: Set<String> = []

    /// - Parameters:
    ///   - embedder: how text becomes a vector. Defaults to `StubTextEmbedder`
    ///     (deterministic, ML-free) so the pipeline is testable before the real
    ///     model is hosted. **Injection point for 19b:** pass an
    ///     `ONNXTextEmbedder` here once distiluse is downloaded/wired.
    ///   - store: seals/opens vectors under the DEK. Default 512-dim.
    ///   - service: the server sync surface (inject a fake in tests).
    ///   - index: starting index (default empty).
    ///   - model: identifier stored beside each blob so a future re-embed can spot
    ///     stale rows. Matches the embedder in use.
    ///   - dek: returns the user's raw DEK, or `nil` until it is loaded.
    init(
        embedder: TextEmbedder = StubTextEmbedder(),
        store: EncryptedVectorStore = EncryptedVectorStore(),
        service: VectorSyncService,
        index: VectorIndex = VectorIndex(),
        model: String = "stub-embedder-v1",
        dek: @escaping () -> SymmetricKey?
    ) {
        self.embedder = embedder
        self.store = store
        self.service = service
        self.index = index
        self.model = model
        self.dek = dek
    }

    /// The number of vectors currently held in memory.
    var count: Int { index.count }

    /// The cached plaintext embedding for `id`, or nil if it is not in the
    /// in-memory index. Lets the soul constellation reuse it instead of
    /// re-embedding the same text.
    func vector(for id: String) -> EmbeddingVector? { index.vector(for: id) }

    // MARK: - Indexing

    /// Embed `text`, seal it under the DEK, sync the blob to the server, and add the
    /// plaintext vector to the in-memory index. Throws `keyUnavailable` if no DEK.
    func indexEntry(id: String, text: String) async throws {
        guard let dek = dek() else { throw SemanticIndexError.keyUnavailable }
        let vector = try await embedder.embed(text)
        let blob = VectorBlobCodec.encode(try store.wrap(vector, dek: dek))
        try await service.upsert([
            VectorSyncItem(entryId: id, blob: blob, dim: vector.dimension, model: model)
        ])
        index.upsert(entryId: id, vector: vector)
        indexedIds.insert(id)
    }

    /// Remove `id` from the server and the in-memory index (idempotent).
    func removeEntry(id: String) async throws {
        try await service.delete(entryId: id)
        index.remove(entryId: id)
        indexedIds.remove(id)
    }

    /// Fetch every synced blob, decrypt each under the DEK, and populate the index.
    /// Fails **closed per item**: a blob that will not decode or decrypt (wrong key,
    /// tampering, dimension mismatch) is skipped, not fatal — one bad row never
    /// aborts the whole load. Throws only if the DEK is entirely unavailable.
    func loadIndex() async throws {
        guard let dek = dek() else { throw SemanticIndexError.keyUnavailable }
        let items = try await service.list()
        for item in items {
            guard let wrapped = VectorBlobCodec.decode(item.blob) else { continue }
            guard let vector = try? store.unwrap(wrapped, dek: dek) else { continue }
            index.upsert(entryId: item.entryId, vector: vector)
            indexedIds.insert(item.entryId)
        }
    }

    /// Index only the entries not already present in the index, sealing + syncing
    /// them in a single batch upsert. A no-op when nothing is missing.
    func backfill(_ entries: [(id: String, text: String)]) async throws {
        let missing = entries.filter { !indexedIds.contains($0.id) }
        guard !missing.isEmpty else { return }
        guard let dek = dek() else { throw SemanticIndexError.keyUnavailable }

        let vectors = try await embedder.embed(batch: missing.map { $0.text })
        var items: [VectorSyncItem] = []
        items.reserveCapacity(missing.count)
        for (entry, vector) in zip(missing, vectors) {
            let blob = VectorBlobCodec.encode(try store.wrap(vector, dek: dek))
            items.append(VectorSyncItem(entryId: entry.id, blob: blob, dim: vector.dimension, model: model))
        }
        try await service.upsert(items)   // one batch POST for the whole backfill

        for (entry, vector) in zip(missing, vectors) {
            index.upsert(entryId: entry.id, vector: vector)
            indexedIds.insert(entry.id)
        }
    }

    // MARK: - Query

    /// Embed `query` and return the top-`k` entry ids by cosine similarity, most
    /// similar first. An empty index returns `[]` (no embedding is even computed).
    func search(query: String, k: Int) async throws -> [String] {
        guard index.count > 0 else { return [] }
        let q = try await embedder.embed(query)
        return index.topK(k, query: q).map { $0.entryId }
    }

    func similarityGraph(neighborsPerNode: Int) async throws -> [(source: String, target: String, score: Double)] {
        try await loadIndex()
        return index.neighbors(perNode: neighborsPerNode)
            .map { (source: $0.source, target: $0.target, score: Double($0.score)) }
    }
}

/// The production coordinator is the sole conformer to the live-path abstraction.
extension SemanticIndexCoordinator: SemanticIndexCoordinating {}
