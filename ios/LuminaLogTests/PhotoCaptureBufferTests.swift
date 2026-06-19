import XCTest
@testable import LuminaLog

final class PhotoCaptureBufferTests: XCTestCase {

    private func d(_ byte: UInt8) -> Data { Data([byte]) }

    func testStartsEmptyWithRemainingSlots() {
        let buffer = PhotoCaptureBuffer(remainingSlots: 3)
        XCTAssertTrue(buffer.captured.isEmpty)
        XCTAssertTrue(buffer.canCapture)
        XCTAssertEqual(buffer.remainingSlots, 3)
    }

    func testAddReducesRemainingAndStoresData() {
        var buffer = PhotoCaptureBuffer(remainingSlots: 3)
        buffer.add(d(1))
        buffer.add(d(2))
        XCTAssertEqual(buffer.captured, [d(1), d(2)])
        XCTAssertEqual(buffer.remainingSlots, 1)
        XCTAssertTrue(buffer.canCapture)
    }

    func testCannotCaptureWhenSlotsFull() {
        var buffer = PhotoCaptureBuffer(remainingSlots: 2)
        buffer.add(d(1))
        buffer.add(d(2))
        XCTAssertFalse(buffer.canCapture)
        XCTAssertEqual(buffer.remainingSlots, 0)
    }

    func testAddIsIgnoredWhenFull() {
        var buffer = PhotoCaptureBuffer(remainingSlots: 1)
        buffer.add(d(1))
        buffer.add(d(2)) // ignored — already full
        XCTAssertEqual(buffer.captured, [d(1)])
    }

    func testRemoveRestoresASlot() {
        var buffer = PhotoCaptureBuffer(remainingSlots: 1)
        buffer.add(d(1))
        XCTAssertFalse(buffer.canCapture)
        buffer.remove(at: 0)
        XCTAssertTrue(buffer.captured.isEmpty)
        XCTAssertTrue(buffer.canCapture)
        XCTAssertEqual(buffer.remainingSlots, 1)
    }

    func testRemoveOutOfRangeIsSafe() {
        var buffer = PhotoCaptureBuffer(remainingSlots: 2)
        buffer.add(d(1))
        buffer.remove(at: 5) // no-op, no crash
        XCTAssertEqual(buffer.captured, [d(1)])
    }

    func testZeroRemainingSlotsCannotCapture() {
        let buffer = PhotoCaptureBuffer(remainingSlots: 0)
        XCTAssertFalse(buffer.canCapture)
    }
}
