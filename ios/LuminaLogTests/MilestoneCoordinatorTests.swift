import XCTest
@testable import LuminaLog

@MainActor
final class MilestoneCoordinatorTests: XCTestCase {
    private func makeStore() -> UserDefaults {
        UserDefaults(suiteName: "test.\(UUID().uuidString)")!
    }

    func testFiresOnCrossingOncePerDay() {
        let c = MilestoneCoordinator(uid: "u", target: 750, defaults: makeStore(), today: { "2026-06-22" })
        var fired: [String] = []
        c.onShouldPresent = { fired.append($0) }
        c.update(goalWords: 700, canPresent: true)
        XCTAssertEqual(fired, [])
        c.update(goalWords: 760, canPresent: true)
        XCTAssertEqual(fired, ["2026-06-22"])      // earned date is today
        c.update(goalWords: 800, canPresent: true)
        XCTAssertEqual(fired, ["2026-06-22"])      // does not re-fire same day
    }

    func testDefersUntilGateOpens() {
        let c = MilestoneCoordinator(uid: "u", target: 750, defaults: makeStore(), today: { "2026-06-22" })
        var fired: [String] = []
        c.onShouldPresent = { fired.append($0) }
        c.update(goalWords: 760, canPresent: false)   // crossed but not safe
        XCTAssertEqual(fired, [])
        c.update(goalWords: 760, canPresent: true)    // becomes safe
        XCTAssertEqual(fired, ["2026-06-22"])
    }

    func testCarriesOriginalEarnedDateAcrossDays() {
        var day = "2026-06-22"
        let c = MilestoneCoordinator(uid: "u", target: 750, defaults: makeStore(), today: { day })
        var fired: [String] = []
        c.onShouldPresent = { fired.append($0) }
        c.update(goalWords: 760, canPresent: false)   // earned on the 22nd, not safe
        day = "2026-06-23"                            // next day; still pending
        c.update(goalWords: 0, canPresent: true)      // gate opens on the 23rd
        XCTAssertEqual(fired, ["2026-06-22"])         // reports the ORIGINAL earned date
    }

    func testDoesNotRefireAfterShownPersisted() {
        let store = makeStore()
        let c1 = MilestoneCoordinator(uid: "u", target: 750, defaults: store, today: { "2026-06-22" })
        var fired = 0; c1.onShouldPresent = { _ in fired += 1 }
        c1.update(goalWords: 760, canPresent: true)
        XCTAssertEqual(fired, 1)
        let c2 = MilestoneCoordinator(uid: "u", target: 750, defaults: store, today: { "2026-06-22" })
        c2.onShouldPresent = { _ in fired += 1 }
        c2.update(goalWords: 900, canPresent: true)
        XCTAssertEqual(fired, 1)                       // persisted "shown today" blocks re-fire
    }
}
