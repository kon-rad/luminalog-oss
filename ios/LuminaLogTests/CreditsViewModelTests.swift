import XCTest
@testable import LuminaLog

@MainActor
final class CreditsViewModelTests: XCTestCase {

    func testStartCapturesBalance() async {
        let credits = MockCreditService(balance: 7)
        let vm = CreditsViewModel(credits: credits)
        vm.start()
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(vm.balance, 7)
        XCTAssertFalse(vm.isUpdatingBalance)
    }

    func testRefreshResolvesWhenBalanceIncreases() async {
        let credits = MockCreditService(balance: 7)
        let vm = CreditsViewModel(credits: credits)
        vm.start()
        try? await Task.sleep(nanoseconds: 100_000_000)

        vm.beginBalanceRefresh()
        XCTAssertTrue(vm.isUpdatingBalance)

        // Simulate the server webhook crediting +10 shortly after.
        credits.simulateServerCredit(10)

        // Poll loop should observe the increase and resolve.
        for _ in 0..<30 where vm.isUpdatingBalance {
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertFalse(vm.isUpdatingBalance)
        XCTAssertTrue(vm.didCompletePurchase)
        XCTAssertEqual(vm.balance, 17)
    }
}
