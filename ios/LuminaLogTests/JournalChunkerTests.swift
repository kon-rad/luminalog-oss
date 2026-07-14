import XCTest
@testable import LuminaLog

final class JournalChunkerTests: XCTestCase {

    func testShortEntryIsOneChunk() {
        let text = "A short reflection about my day."
        XCTAssertEqual(JournalChunker.chunks(of: text), [text])
    }

    func testEmptyAndWhitespaceProduceNoChunks() {
        XCTAssertEqual(JournalChunker.chunks(of: ""), [])
        XCTAssertEqual(JournalChunker.chunks(of: "   \n  "), [])
    }

    func testLongEntrySlidesWithOverlapDeterministically() {
        let text = String(repeating: "x", count: 1300) // > chunkSize
        let a = JournalChunker.chunks(of: text)
        let b = JournalChunker.chunks(of: text)
        XCTAssertEqual(a, b, "chunker must be deterministic")
        // step = 600 - 100 = 500 → starts 0, 500, 1000 → 3 chunks for 1300 chars
        XCTAssertEqual(a.count, 3)
        XCTAssertEqual(a[0].count, 600) // chars 0..<600
        XCTAssertEqual(a[1].count, 600) // chars 500..<1100
        XCTAssertEqual(a[2].count, 300) // chars 1000..<1300
    }

    func testChunkAtRetrievalMatchesChunkAtIndex() {
        // The core invariant: re-chunking the same content reproduces chunk[i].
        let text = String(repeating: "The quick brown fox. ", count: 60) // ~1260 chars
        let indexed = JournalChunker.chunks(of: text)
        let retrieved = JournalChunker.chunks(of: text)
        XCTAssertEqual(indexed, retrieved)
        XCTAssertEqual(indexed[1], retrieved[1])
    }
}
