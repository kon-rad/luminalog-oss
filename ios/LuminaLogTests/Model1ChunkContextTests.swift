import XCTest
@testable import LuminaLog

/// Chunk-only RAG context (Architecture A): `chunkContext` formats ONLY the matched
/// chunks (re-extracted via the deterministic `JournalChunker`), not whole entries.
final class Model1ChunkContextTests: XCTestCase {

    private func makeEntry(id: String, content: String, title: String = "T") -> JournalEntry {
        JournalEntry(id: id, userId: "u", type: .text, title: title, content: content)
    }

    func testUsesOnlyTheReferencedChunk() {
        // 1200 chars → 3 chunks (size 600, step 500). Chunk 2 is all "B".
        let content = String(repeating: "A", count: 600) + String(repeating: "B", count: 600)
        let entry = makeEntry(id: "e1", content: content)
        let expected = JournalChunker.chunks(of: content)
        XCTAssertEqual(expected.count, 3)

        let ctx = Model1Requests.chunkContext(from: [entry], refs: [ChunkRef(entryId: "e1", chunkIndex: 2, score: 0.9)])

        XCTAssertTrue(ctx.contains(expected[2]), "context should contain chunk 2")
        XCTAssertFalse(ctx.contains(String(repeating: "A", count: 600)), "chunk 0 (all A) must be excluded")
        XCTAssertTrue(ctx.contains("[#1 — text · T ·"), "header shape matches format()")
    }

    func testSkipsUnknownEntryAndOutOfRangeChunk() {
        let entry = makeEntry(id: "e1", content: "short entry")
        let ctx = Model1Requests.chunkContext(from: [entry], refs: [
            ChunkRef(entryId: "missing", chunkIndex: 0, score: 0.9), // unknown entry → skipped
            ChunkRef(entryId: "e1", chunkIndex: 9, score: 0.8),      // out of range → skipped
            ChunkRef(entryId: "e1", chunkIndex: 0, score: 0.7),      // valid → the whole short entry
        ])
        XCTAssertTrue(ctx.contains("short entry"))
        // Only one block survived (the valid ref) → numbered #1, no #2.
        XCTAssertTrue(ctx.contains("[#1 —"))
        XCTAssertFalse(ctx.contains("[#2 —"))
    }

    func testEmptyRefsProduceEmptyContext() {
        XCTAssertEqual(Model1Requests.chunkContext(from: [makeEntry(id: "e1", content: "x")], refs: []), "")
    }
}
