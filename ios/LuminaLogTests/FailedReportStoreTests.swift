import XCTest
@testable import LuminaLog

@MainActor
final class FailedReportStoreTests: XCTestCase {

    private func tempDir() -> URL {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func testRecordClearAndPersist() {
        let dir = tempDir()
        let auth = MockAuthService(signedIn: true)
        let store = FailedReportStore(auth: auth, directory: dir)

        store.record("2026-06-24")
        store.record("2026-06-25")
        store.clear("2026-06-24")
        XCTAssertEqual(store.dates(), ["2026-06-25"])

        // A fresh instance over the same directory restores state.
        let reopened = FailedReportStore(auth: auth, directory: dir)
        XCTAssertEqual(reopened.dates(), ["2026-06-25"])
    }

    func testNoUserIsANoOp() {
        let store = FailedReportStore(auth: MockAuthService(signedIn: false), directory: tempDir())
        store.record("2026-06-25")
        XCTAssertTrue(store.dates().isEmpty)
    }

    func testSeenFailurePersistsUntilCleared() {
        let dir = tempDir()
        let auth = MockAuthService(signedIn: true)
        let store = FailedReportStore(auth: auth, directory: dir)
        store.record("2026-11-23")
        XCTAssertFalse(store.hasSeen("2026-11-23"))

        store.markSeen("2026-11-23")
        let reopened = FailedReportStore(auth: auth, directory: dir)
        XCTAssertEqual(reopened.dates(), ["2026-11-23"])
        XCTAssertTrue(reopened.hasSeen("2026-11-23"))

        reopened.clear("2026-11-23")
        let cleared = FailedReportStore(auth: auth, directory: dir)
        XCTAssertTrue(cleared.dates().isEmpty)
        XCTAssertFalse(cleared.hasSeen("2026-11-23"))
    }
}
