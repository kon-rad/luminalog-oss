import XCTest
@testable import LuminaLog

private actor FakeRag: RagServing {
    var indexed: [(entryId: String, chunks: [String])] = []
    var deleted: [String] = []
    var refs: [ChunkRef] = [
        ChunkRef(entryId: "e1", chunkIndex: 0, score: 0.9),
        ChunkRef(entryId: "e1", chunkIndex: 2, score: 0.7), // same entry, lower rank
        ChunkRef(entryId: "e2", chunkIndex: 1, score: 0.6),
    ]

    func index(entryId: String, type: String, dayIndex: Int, wordCount: Int, chunks: [String]) async throws {
        indexed.append((entryId, chunks))
    }
    func search(query: String, topK: Int) async throws -> [ChunkRef] { refs }
    func delete(entryId: String) async throws { deleted.append(entryId) }
}

final class ServerSemanticIndexTests: XCTestCase {

    func testIndexEntryChunksAndForwards() async throws {
        let rag = FakeRag()
        try await ServerSemanticIndex(rag: rag).indexEntry(id: "e1", text: "hello world")
        let indexed = await rag.indexed
        XCTAssertEqual(indexed.first?.entryId, "e1")
        XCTAssertEqual(indexed.first?.chunks, JournalChunker.chunks(of: "hello world"))
    }

    func testSearchDedupesEntryIdsPreservingBestRank() async throws {
        let ids = try await ServerSemanticIndex(rag: FakeRag()).search(query: "q", k: 8)
        XCTAssertEqual(ids, ["e1", "e2"]) // e1 first (0.9), deduped; e2 second
    }

    func testSearchChunksReturnsRawRefs() async throws {
        let refs = try await ServerSemanticIndex(rag: FakeRag()).searchChunks(query: "q", k: 8)
        XCTAssertEqual(refs.count, 3)
        XCTAssertEqual(refs.first, ChunkRef(entryId: "e1", chunkIndex: 0, score: 0.9))
    }

    func testRemoveEntryDeletes() async throws {
        let rag = FakeRag()
        try await ServerSemanticIndex(rag: rag).removeEntry(id: "e9")
        let deleted = await rag.deleted
        XCTAssertEqual(deleted, ["e9"])
    }
}
