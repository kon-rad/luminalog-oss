import XCTest
@testable import LuminaLog

@MainActor
final class UsernameEditViewModelTests: XCTestCase {

    private var service: MockInboxService!
    private var now: Date!

    override func setUp() async throws {
        service = MockInboxService()
        now = Date()
    }

    override func tearDown() async throws {
        service = nil
        now = nil
    }

    // MARK: - Local validation skips network for invalid chars

    func testInvalidCharsSkipsNetwork() async {
        let vm = makeVM(current: nil, changedAt: nil)

        vm.text = "user name!"
        await vm.textChanged()

        // Should skip network; status should be unavailable with invalid reason
        if case .unavailable(let reason) = vm.status {
            XCTAssertTrue(reason.contains("invalid") || reason.contains("Invalid") || reason.contains("letter") || reason.contains("number"))
        } else {
            XCTFail("Expected .unavailable for invalid chars, got \(vm.status)")
        }
        XCTAssertTrue(service.checkedNames.isEmpty, "Network should not be called for invalid input")
    }

    // MARK: - Available name normalizes and sets status

    func testAvailableNameNormalizesAndSetsAvailable() async {
        service.checkResult = UsernameCheck(username: "validuser", available: true, reason: nil)
        let vm = makeVM(current: nil, changedAt: nil)

        vm.text = "  ValidUser  "
        await vm.textChanged()

        // Should be available (text is trimmed/lowercased before check)
        guard case .available = vm.status else {
            XCTFail("Expected .available, got \(vm.status)")
            return
        }
        XCTAssertEqual(service.checkedNames.last, "validuser")
    }

    // MARK: - Taken name shows unavailable

    func testTakenNameShowsUnavailable() async {
        service.checkResult = UsernameCheck(username: "takenuser", available: false, reason: "taken")
        let vm = makeVM(current: nil, changedAt: nil)

        vm.text = "takenuser"
        await vm.textChanged()

        guard case .unavailable(let reason) = vm.status else {
            XCTFail("Expected .unavailable, got \(vm.status)")
            return
        }
        XCTAssertTrue(reason.contains("taken") || reason.contains("Taken") || reason.contains("unavailable"))
    }

    // MARK: - Locked within 30 days shows lockedUntil

    func testLockedWithin30DaysShowsLockedUntil() async {
        let changedAt = now.addingTimeInterval(-86400 * 15) // 15 days ago
        let vm = makeVM(current: "olduser", changedAt: changedAt)

        // lockedUntil should be set (30 days - 15 days = 15 days from now)
        XCTAssertNotNil(vm.lockedUntil)
        if let lockedUntil = vm.lockedUntil {
            let expected = changedAt.addingTimeInterval(86400 * 30)
            let diff = lockedUntil.timeIntervalSince(expected)
            XCTAssertLessThan(abs(diff), 1, "lockedUntil should be 30 days after changedAt")
        }
    }

    func testNoLockWhenPast30Days() async {
        let changedAt = now.addingTimeInterval(-86400 * 31) // 31 days ago
        let vm = makeVM(current: "olduser", changedAt: changedAt)

        XCTAssertNil(vm.lockedUntil, "Should not be locked when 30+ days have passed")
    }

    // MARK: - Save calls setUsername and reports .saved

    /// The view dismisses and calls its own `onSaved` when `status` becomes `.saved`.
    func testSaveCallsSetUsernameAndReportsSaved() async {
        let update = UsernameUpdate(
            username: "newuser",
            usernameChangedAt: now,
            nextChangeAt: now.addingTimeInterval(86400 * 30)
        )
        service.setResult = .success(update)

        let vm = makeVM(current: "olduser", changedAt: now.addingTimeInterval(-86400 * 31))

        vm.text = "newuser"
        vm.status = .available // Pretend check passed

        let success = await vm.save()

        XCTAssertTrue(success)
        XCTAssertEqual(service.checkedNames.last, "newuser")
        XCTAssertEqual(vm.status, .saved(update))
    }

    func testSaveFailure() async {
        service.setResult = .failure(UsernameError.unknown)
        let vm = makeVM(current: "olduser", changedAt: nil)

        vm.text = "newuser"
        vm.status = .available

        let success = await vm.save()

        XCTAssertFalse(success)
        guard case .failed = vm.status else {
            XCTFail("Expected .failed status after save failure, got \(vm.status)")
            return
        }
    }

    // MARK: - canSave

    func testCanSaveOnlyWhenAvailable() {
        let vm = makeVM(current: nil, changedAt: nil)

        vm.status = .idle
        XCTAssertFalse(vm.canSave)

        vm.status = .checking
        XCTAssertFalse(vm.canSave)

        vm.status = .available
        XCTAssertTrue(vm.canSave)

        vm.status = .unavailable("taken")
        XCTAssertFalse(vm.canSave)

        vm.status = .saving
        XCTAssertFalse(vm.canSave)

        vm.status = .failed("error")
        XCTAssertFalse(vm.canSave)
    }

    // MARK: - Helpers

    private func makeVM(
        current: String?,
        changedAt: Date?,
        debounceNanoseconds: UInt64 = 1 // no real debounce in tests
    ) -> UsernameEditViewModel {
        UsernameEditViewModel(
            service: service,
            current: current,
            changedAt: changedAt,
            now: { self.now },
            debounceNanoseconds: debounceNanoseconds
        )
    }
}