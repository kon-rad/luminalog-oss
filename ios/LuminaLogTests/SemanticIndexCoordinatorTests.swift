import XCTest
import CryptoKit
@testable import LuminaLog

// MARK: - Fake sync service

/// Captures every call and stands in for the server: `list()` returns whatever has
/// been `upsert`ed (minus what was `delete`d), so a coordinator can round-trip
/// through it with no network.
private final class FakeVectorSyncService: VectorSyncService {
    private(set) var upsertBatches: [[VectorSyncItem]] = []
    private(set) var deleted: [String] = []
    /// Server-side store, keyed by entryId. Overridable for load/skip tests.
    var stored: [VectorSyncItem] = []

    func upsert(_ items: [VectorSyncItem]) async throws {
        upsertBatches.append(items)
        for item in items {
            stored.removeAll { $0.entryId == item.entryId }
            stored.append(item)
        }
    }

    func list() async throws -> [VectorSyncItem] { stored }

    func delete(entryId: String) async throws {
        deleted.append(entryId)
        stored.removeAll { $0.entryId == entryId }
    }
}

// MARK: - Tests

final class SemanticIndexCoordinatorTests: XCTestCase {

    private let dek = SymmetricKey(size: .bits256)

    private func makeCoordinator(
        service: VectorSyncService,
        index: VectorIndex = VectorIndex()
    ) -> SemanticIndexCoordinator {
        SemanticIndexCoordinator(
            embedder: StubTextEmbedder(),
            store: EncryptedVectorStore(),
            service: service,
            index: index,
            dek: { [dek] in dek }
        )
    }

    // MARK: indexEntry

    func testIndexEntryUpsertsSealsAndIndexes() async throws {
        let service = FakeVectorSyncService()
        let coordinator = makeCoordinator(service: service)

        try await coordinator.indexEntry(id: "e1", text: "a quiet morning walk")

        // One upsert of exactly one item.
        XCTAssertEqual(service.upsertBatches.count, 1)
        XCTAssertEqual(service.upsertBatches[0].count, 1)
        let item = service.upsertBatches[0][0]
        XCTAssertEqual(item.entryId, "e1")
        XCTAssertEqual(item.dim, EmbeddingVector.dimension)

        // Index now holds one vector.
        XCTAssertEqual(coordinator.count, 1)

        // The synced blob decrypts back to the stub embedding of the text.
        let wrapped = try XCTUnwrap(VectorBlobCodec.decode(item.blob))
        let opened = try EncryptedVectorStore().unwrap(wrapped, dek: dek)
        let expected = try await StubTextEmbedder().embed("a quiet morning walk")
        XCTAssertEqual(opened, expected)
    }

    func testIndexEntryWithoutKeyFailsClosed() async throws {
        let service = FakeVectorSyncService()
        let coordinator = SemanticIndexCoordinator(
            service: service, dek: { nil }
        )
        do {
            try await coordinator.indexEntry(id: "e1", text: "hello")
            XCTFail("Expected keyUnavailable")
        } catch let error as SemanticIndexError {
            XCTAssertEqual(error, .keyUnavailable)
        }
        XCTAssertTrue(service.upsertBatches.isEmpty)
    }

    // MARK: loadIndex

    func testLoadIndexPopulatesFromListedBlobs() async throws {
        let service = FakeVectorSyncService()
        // Seed the "server" by indexing through a first coordinator.
        let seeder = makeCoordinator(service: service)
        try await seeder.indexEntry(id: "a", text: "sunrise over the harbor")
        try await seeder.indexEntry(id: "b", text: "late night coding session")

        // A fresh coordinator with an empty index loads them back.
        let loader = makeCoordinator(service: service)
        XCTAssertEqual(loader.count, 0)
        try await loader.loadIndex()
        XCTAssertEqual(loader.count, 2)

        // Loaded vectors are usable for search (exact-text query → that id first).
        let hits = try await loader.search(query: "late night coding session", k: 1)
        XCTAssertEqual(hits, ["b"])
    }

    func testLoadIndexSkipsUndecodableBlob() async throws {
        let service = FakeVectorSyncService()
        // One valid row (produced by a real seal) + one garbage blob.
        let seeder = makeCoordinator(service: service)
        try await seeder.indexEntry(id: "good", text: "valid entry")
        service.stored.append(
            VectorSyncItem(entryId: "bad", blob: "###not-a-blob###", dim: 768, model: "x")
        )

        let loader = makeCoordinator(service: service)
        try await loader.loadIndex()   // must not throw
        XCTAssertEqual(loader.count, 1, "Undecodable blob is skipped, valid one loaded")
    }

    // MARK: search

    func testSearchReturnsMostSimilarEntry() async throws {
        let service = FakeVectorSyncService()
        let coordinator = makeCoordinator(service: service)
        try await coordinator.indexEntry(id: "walk", text: "a quiet morning walk")
        try await coordinator.indexEntry(id: "code", text: "debugging a tricky race condition")
        try await coordinator.indexEntry(id: "cook", text: "simmering tomato sauce all afternoon")

        // The stub embedder is deterministic: the exact text of an entry embeds to
        // that entry's vector (cosine 1.0), so it must rank first.
        let hits = try await coordinator.search(query: "debugging a tricky race condition", k: 3)
        XCTAssertEqual(hits.first, "code")
    }

    func testSearchEmptyIndexReturnsEmpty() async throws {
        let service = FakeVectorSyncService()
        let coordinator = makeCoordinator(service: service)
        let hits = try await coordinator.search(query: "anything", k: 5)
        XCTAssertEqual(hits, [])
    }

    // MARK: removeEntry

    func testRemoveEntryDeletesAndDrops() async throws {
        let service = FakeVectorSyncService()
        let coordinator = makeCoordinator(service: service)
        try await coordinator.indexEntry(id: "keep", text: "one")
        try await coordinator.indexEntry(id: "drop", text: "two")
        XCTAssertEqual(coordinator.count, 2)

        try await coordinator.removeEntry(id: "drop")

        XCTAssertEqual(service.deleted, ["drop"])
        XCTAssertEqual(coordinator.count, 1)
        XCTAssertFalse(service.stored.contains { $0.entryId == "drop" })
    }

    // MARK: backfill

    func testBackfillOnlyIndexesMissing() async throws {
        let service = FakeVectorSyncService()
        let coordinator = makeCoordinator(service: service)
        try await coordinator.indexEntry(id: "a", text: "already here")
        XCTAssertEqual(service.upsertBatches.count, 1)

        try await coordinator.backfill([
            (id: "a", text: "already here"),
            (id: "b", text: "brand new b"),
            (id: "c", text: "brand new c"),
        ])

        // A second upsert batch containing only the two missing ids.
        XCTAssertEqual(service.upsertBatches.count, 2)
        let batch = service.upsertBatches[1]
        XCTAssertEqual(Set(batch.map(\.entryId)), ["b", "c"])
        XCTAssertEqual(coordinator.count, 3)
    }

    func testBackfillNoMissingIsNoOp() async throws {
        let service = FakeVectorSyncService()
        let coordinator = makeCoordinator(service: service)
        try await coordinator.indexEntry(id: "a", text: "here")

        try await coordinator.backfill([(id: "a", text: "here")])
        XCTAssertEqual(service.upsertBatches.count, 1, "No extra upsert when nothing is missing")
        XCTAssertEqual(coordinator.count, 1)
    }
}
