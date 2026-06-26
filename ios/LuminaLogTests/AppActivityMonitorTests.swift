import XCTest
@testable import LuminaLog

@MainActor
final class AppActivityMonitorTests: XCTestCase {

    func testDefaultIsSafeOnHome() {
        let m = AppActivityMonitor()
        XCTAssertTrue(m.canPresentInterruption)
    }

    func testNotSafeOffHome() {
        let m = AppActivityMonitor()
        m.setOnHomeTab(false)
        XCTAssertFalse(m.canPresentInterruption)
    }

    func testNotSafeWhileSurfacePresented() {
        let m = AppActivityMonitor()
        m.beginSurface()
        XCTAssertFalse(m.canPresentInterruption)
        m.endSurface()
        XCTAssertTrue(m.canPresentInterruption)
    }

    func testSurfaceCountIsBalancedAndNeverNegative() {
        let m = AppActivityMonitor()
        m.beginSurface(); m.beginSurface()
        m.endSurface()
        XCTAssertFalse(m.canPresentInterruption)
        m.endSurface()
        m.endSurface()
        XCTAssertTrue(m.canPresentInterruption)
    }

    func testNotSafeWhileRecording() {
        let m = AppActivityMonitor()
        m.setRecording(true)
        XCTAssertFalse(m.canPresentInterruption)
        m.setRecording(false)
        XCTAssertTrue(m.canPresentInterruption)
    }

    func testNotSafeWhileProcessingEntry() {
        let m = AppActivityMonitor()
        m.setProcessingEntry(true)
        XCTAssertFalse(m.canPresentInterruption)
        m.setProcessingEntry(false)
        XCTAssertTrue(m.canPresentInterruption)
    }
}
