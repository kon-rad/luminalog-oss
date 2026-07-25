import XCTest
@testable import LuminaLog

@MainActor
final class SegmentRecorderTests: XCTestCase {

    func testNormalizeMapsDecibelsToUnitRange() {
        XCTAssertEqual(SegmentRecorder.normalize(power: 0), 1.0, accuracy: 0.0001)
        XCTAssertEqual(SegmentRecorder.normalize(power: -50), 0.0, accuracy: 0.0001)
        XCTAssertEqual(SegmentRecorder.normalize(power: -200), 0.0, accuracy: 0.0001)
        XCTAssertEqual(SegmentRecorder.normalize(power: -25), 0.5, accuracy: 0.0001)
    }

    func testFreshRecorderIsInactive() {
        let recorder = SegmentRecorder()
        XCTAssertFalse(recorder.isActive)
        XCTAssertEqual(recorder.currentSegmentTime, 0, accuracy: 0.0001)
        XCTAssertTrue(recorder.levels.isEmpty)
    }
}
