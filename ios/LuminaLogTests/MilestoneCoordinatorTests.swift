import XCTest
@testable import LuminaLog

@MainActor
final class MilestoneCoordinatorTests: XCTestCase {
    private func makeStore() -> UserDefaults {
        let d = UserDefaults(suiteName: "test.\(UUID().uuidString)")!
        return d
    }

    func testFiresOnCrossingOncePerDay() {
        let c = MilestoneCoordinator(uid: "u", target: 750, defaults: makeStore(), today: { "2026-06-22" })
        var fired = 0
        c.onShouldPresent = { fired += 1 }
        c.update(goalWords: 700, isRecording: false)
        XCTAssertEqual(fired, 0)
        c.update(goalWords: 760, isRecording: false)
        XCTAssertEqual(fired, 1)
        c.update(goalWords: 800, isRecording: false)
        XCTAssertEqual(fired, 1)
    }

    func testDefersWhileRecording() {
        let c = MilestoneCoordinator(uid: "u", target: 750, defaults: makeStore(), today: { "2026-06-22" })
        var fired = 0
        c.onShouldPresent = { fired += 1 }
        c.update(goalWords: 760, isRecording: true)
        XCTAssertEqual(fired, 0)
        c.update(goalWords: 760, isRecording: false)
        XCTAssertEqual(fired, 1)
    }

    func testDoesNotRefireAfterShownPersisted() {
        let store = makeStore()
        let c1 = MilestoneCoordinator(uid: "u", target: 750, defaults: store, today: { "2026-06-22" })
        var fired = 0; c1.onShouldPresent = { fired += 1 }
        c1.update(goalWords: 760, isRecording: false)
        XCTAssertEqual(fired, 1)
        let c2 = MilestoneCoordinator(uid: "u", target: 750, defaults: store, today: { "2026-06-22" })
        c2.onShouldPresent = { fired += 1 }
        c2.update(goalWords: 900, isRecording: false)
        XCTAssertEqual(fired, 1)
    }
}
