import XCTest
@testable import LuminaLog

@MainActor
final class PaywallGateViewModelTests: XCTestCase {

    /// Entitlement spy that can push later emissions (e.g. a lapse).
    private final class Spy: SubscriptionService {
        private var entitlement: Entitlement
        private var conts: [UUID: AsyncStream<Entitlement>.Continuation] = [:]
        init(_ entitlement: Entitlement = Entitlement()) { self.entitlement = entitlement }
        func entitlementStream() -> AsyncStream<Entitlement> {
            AsyncStream { c in
                let k = UUID()
                conts[k] = c
                c.onTermination = { _ in Task { @MainActor in self.conts[k] = nil } }
                c.yield(entitlement)
            }
        }
        func setUser(_ uid: String?) async {}
        func purchase(productId: String) async throws {}
        func restore() async throws {}
        func presentCodeRedemptionSheet() {}
        func push(_ entitlement: Entitlement) {
            self.entitlement = entitlement
            conts.values.forEach { $0.yield(entitlement) }
        }
    }

    /// A service that never emits — exercises the fail-open timeout.
    private final class Silent: SubscriptionService {
        func entitlementStream() -> AsyncStream<Entitlement> { AsyncStream { _ in } }
        func setUser(_ uid: String?) async {}
        func purchase(productId: String) async throws {}
        func restore() async throws {}
        func presentCodeRedemptionSheet() {}
    }

    private func waitUntil(timeout: TimeInterval = 2, _ condition: () -> Bool) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
    }

    func testProBaselineUnlocks() async {
        let vm = PaywallGateViewModel(subscriptions: Spy(Entitlement(isPro: true)))
        vm.start()
        await waitUntil { vm.state == .unlocked }
        XCTAssertEqual(vm.state, .unlocked)
    }

    func testFreeBaselineLocks() async {
        let vm = PaywallGateViewModel(subscriptions: Spy())
        vm.start()
        await waitUntil { vm.state == .locked }
        XCTAssertEqual(vm.state, .locked)
    }

    func testLapseFlipsUnlockedToLocked() async {
        let spy = Spy(Entitlement(isPro: true))
        let vm = PaywallGateViewModel(subscriptions: spy)
        vm.start()
        await waitUntil { vm.state == .unlocked }
        spy.push(Entitlement(isPro: false))
        await waitUntil { vm.state == .locked }
        XCTAssertEqual(vm.state, .locked)
    }

    func testFailOpenWhenLastKnownProAndNoEmission() async {
        UserDefaults.standard.set(true, forKey: "ll-last-known-pro")
        defer { UserDefaults.standard.removeObject(forKey: "ll-last-known-pro") }
        let vm = PaywallGateViewModel(subscriptions: Silent())
        vm.resolveTimeout = .milliseconds(100)
        vm.start()
        await waitUntil { vm.state == .unlocked }
        XCTAssertEqual(vm.state, .unlocked, "A paying subscriber is not locked out on a flaky launch")
    }

    func testLocksWhenNoLastKnownProAndNoEmission() async {
        UserDefaults.standard.set(false, forKey: "ll-last-known-pro")
        defer { UserDefaults.standard.removeObject(forKey: "ll-last-known-pro") }
        let vm = PaywallGateViewModel(subscriptions: Silent())
        vm.resolveTimeout = .milliseconds(100)
        vm.start()
        await waitUntil { vm.state == .locked }
        XCTAssertEqual(vm.state, .locked)
    }
}
