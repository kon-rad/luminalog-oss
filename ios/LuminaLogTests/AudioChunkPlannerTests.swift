import XCTest
@testable import LuminaLog

/// `AudioChunkPlanner.ranges` cuts an audio timeline into upload-sized windows so
/// no single `/transcribe-clip` request exceeds the server's 25 MB body limit.
final class AudioChunkPlannerTests: XCTestCase {

    func testEmptyForNonPositiveDuration() {
        XCTAssertEqual(AudioChunkPlanner.ranges(totalSeconds: 0, maxChunkSeconds: 600), [])
        XCTAssertEqual(AudioChunkPlanner.ranges(totalSeconds: -10, maxChunkSeconds: 600), [])
    }

    func testEmptyForNonPositiveMaxChunk() {
        XCTAssertEqual(AudioChunkPlanner.ranges(totalSeconds: 100, maxChunkSeconds: 0), [])
    }

    func testSingleRangeWhenClipFits() {
        let ranges = AudioChunkPlanner.ranges(totalSeconds: 100, maxChunkSeconds: 600)
        XCTAssertEqual(ranges, [.init(start: 0, duration: 100)])
    }

    func testSplitsWithRemainderInFinalChunk() {
        let ranges = AudioChunkPlanner.ranges(totalSeconds: 1500, maxChunkSeconds: 600)
        XCTAssertEqual(ranges, [
            .init(start: 0, duration: 600),
            .init(start: 600, duration: 600),
            .init(start: 1200, duration: 300),
        ])
    }

    func testExactMultipleHasNoSliverChunk() {
        // 1200 / 600 == 2 exactly — floating-point drift must not add a 3rd sliver.
        let ranges = AudioChunkPlanner.ranges(totalSeconds: 1200, maxChunkSeconds: 600)
        XCTAssertEqual(ranges, [
            .init(start: 0, duration: 600),
            .init(start: 600, duration: 600),
        ])
    }

    func testChunksAreContiguousAndCoverWholeDuration() {
        let total = 3725.0
        let ranges = AudioChunkPlanner.ranges(totalSeconds: total, maxChunkSeconds: 600)
        XCTAssertEqual(ranges.first?.start, 0)
        // Contiguous: each chunk starts where the previous ended.
        for (prev, next) in zip(ranges, ranges.dropFirst()) {
            XCTAssertEqual(prev.start + prev.duration, next.start, accuracy: 1e-6)
        }
        // Full coverage: the last chunk ends exactly at the total duration.
        let last = ranges.last!
        XCTAssertEqual(last.start + last.duration, total, accuracy: 1e-6)
        XCTAssertTrue(ranges.allSatisfy { $0.duration <= 600 + 1e-6 })
    }
}
