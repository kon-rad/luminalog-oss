import XCTest
import UserNotifications
@testable import LuminaLog

/// Multi-slot reminder scheduling: on `refresh`, every enabled slot schedules
/// its next fire (gated on the 750-word goal) while disabled/unauthorized slots
/// are cancelled. Authorization is requested automatically only when it is still
/// undetermined.
@MainActor
final class ReminderCoordinatorTests: XCTestCase {

    /// Records `reschedule` calls per identifier and stubs authorization.
    private final class FakeScheduler: ReminderScheduling {
        var status: UNAuthorizationStatus
        var grantOnRequest: Bool
        private(set) var requestCount = 0
        private(set) var calls: [(id: String, fire: Date?)] = []

        init(status: UNAuthorizationStatus, grantOnRequest: Bool = true) {
            self.status = status
            self.grantOnRequest = grantOnRequest
        }

        func requestAuthorization() async -> Bool {
            requestCount += 1
            return grantOnRequest
        }

        func authorizationStatus() async -> UNAuthorizationStatus { status }

        func reschedule(identifier: String, title: String, body: String, to fireDate: Date?) async {
            calls.append((identifier, fireDate))
        }

        /// The last fire date scheduled for `id` (inner nil = cancelled;
        /// outer nil = never called).
        func fire(for id: String) -> Date?? {
            calls.last { $0.id == id }?.fire
        }
    }

    private let tz = TimeZone(identifier: "America/Los_Angeles")!

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = tz
        return c
    }

    private func date(_ y: Int, _ m: Int, _ d: Int, _ hour: Int, _ minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d, hour: hour, minute: minute))!
    }

    private func makeDefaults() -> UserDefaults {
        let name = "test-reminders-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: name)!
        d.removePersistentDomain(forName: name)
        return d
    }

    private func profile(goalMet: Bool, reference: Date) -> UserProfile {
        var stats = UserProfile.Stats()
        if goalMet {
            stats.goalDayDate = reference
            stats.goalDayWords = DailyGoal.wordTarget
        }
        return UserProfile(id: "u", timezone: tz.identifier, stats: stats)
    }

    // Fixed "now": 9 AM, so both 6 PM and 10 PM are still ahead today.
    private var now: Date { date(2026, 6, 10, 9) }

    private func makeCoordinator(
        scheduler: FakeScheduler,
        defaults: UserDefaults
    ) -> ReminderCoordinator {
        ReminderCoordinator(scheduler: scheduler, defaults: defaults, now: { self.now })
    }

    func testAuthorizedDefaultsScheduleEveningAndNightTodayNotPrimary() async {
        let scheduler = FakeScheduler(status: .authorized)
        let coordinator = makeCoordinator(scheduler: scheduler, defaults: makeDefaults())

        await coordinator.refresh(profile: profile(goalMet: false, reference: now))

        XCTAssertEqual(scheduler.fire(for: "ll-reminder-evening"), date(2026, 6, 10, 18))
        XCTAssertEqual(scheduler.fire(for: "ll-reminder-night"), date(2026, 6, 10, 22))
        // Primary is off by default → cancelled.
        XCTAssertEqual(scheduler.fire(for: "ll-daily-reminder"), .some(nil))
        XCTAssertEqual(scheduler.requestCount, 0)
    }

    func testDisabledSlotIsCancelled() async {
        let scheduler = FakeScheduler(status: .authorized)
        let defaults = makeDefaults()
        defaults.set(false, forKey: "ll-reminder-evening.enabled")
        let coordinator = makeCoordinator(scheduler: scheduler, defaults: defaults)

        await coordinator.refresh(profile: profile(goalMet: false, reference: now))

        XCTAssertEqual(scheduler.fire(for: "ll-reminder-evening"), .some(nil))
        XCTAssertEqual(scheduler.fire(for: "ll-reminder-night"), date(2026, 6, 10, 22))
    }

    func testGoalMetPushesAllToTomorrow() async {
        let scheduler = FakeScheduler(status: .authorized)
        let coordinator = makeCoordinator(scheduler: scheduler, defaults: makeDefaults())

        await coordinator.refresh(profile: profile(goalMet: true, reference: now))

        XCTAssertEqual(scheduler.fire(for: "ll-reminder-evening"), date(2026, 6, 11, 18))
        XCTAssertEqual(scheduler.fire(for: "ll-reminder-night"), date(2026, 6, 11, 22))
    }

    func testRequestsAuthorizationWhenUndeterminedThenSchedules() async {
        let scheduler = FakeScheduler(status: .notDetermined, grantOnRequest: true)
        let coordinator = makeCoordinator(scheduler: scheduler, defaults: makeDefaults())

        await coordinator.refresh(profile: profile(goalMet: false, reference: now))

        XCTAssertEqual(scheduler.requestCount, 1)
        XCTAssertEqual(scheduler.fire(for: "ll-reminder-evening"), date(2026, 6, 10, 18))
    }

    func testUndeterminedButDeniedSchedulesNothing() async {
        let scheduler = FakeScheduler(status: .notDetermined, grantOnRequest: false)
        let coordinator = makeCoordinator(scheduler: scheduler, defaults: makeDefaults())

        await coordinator.refresh(profile: profile(goalMet: false, reference: now))

        XCTAssertEqual(scheduler.requestCount, 1)
        XCTAssertEqual(scheduler.fire(for: "ll-reminder-evening"), .some(nil))
        XCTAssertEqual(scheduler.fire(for: "ll-reminder-night"), .some(nil))
    }

    func testDeniedDoesNotRequestAgainAndSchedulesNothing() async {
        let scheduler = FakeScheduler(status: .denied)
        let coordinator = makeCoordinator(scheduler: scheduler, defaults: makeDefaults())

        await coordinator.refresh(profile: profile(goalMet: false, reference: now))

        XCTAssertEqual(scheduler.requestCount, 0)
        XCTAssertEqual(scheduler.fire(for: "ll-reminder-evening"), .some(nil))
    }

    func testSetEnabledFalsePersistsAndCancelsOnlyThatSlot() async {
        let scheduler = FakeScheduler(status: .authorized)
        let defaults = makeDefaults()
        let coordinator = makeCoordinator(scheduler: scheduler, defaults: defaults)
        let night = ReminderSlot.all.first { $0.id == "ll-reminder-night" }!

        _ = await coordinator.setEnabled(false, for: night, profile: profile(goalMet: false, reference: now))

        XCTAssertFalse(defaults.bool(forKey: "ll-reminder-night.enabled"))
        XCTAssertEqual(scheduler.fire(for: "ll-reminder-night"), .some(nil))
    }
}
