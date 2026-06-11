import XCTest
@testable import LuminaLog

/// PaywallViewModel completes via the entitlement stream, so tests poll the
/// published state with a bounded wait (same pattern as HomeViewModelTests).
final class PaywallViewModelTests: XCTestCase {

    // MARK: - Spy

    /// Deterministic, delay-free `SubscriptionService` that records calls and
    /// flips the entitlement to pro on purchase.
    @MainActor
    private final class SpySubscriptionService: SubscriptionService {
        struct ServiceError: Error {}

        private(set) var purchaseCalls: [String] = []
        private(set) var restoreCalls = 0
        var purchaseShouldFail = false
        var offeringsShouldFail = false

        var offers = [
            SubscriptionOffer(id: "spy.monthly", title: "Pro", price: "$6.99", period: "month"),
            SubscriptionOffer(id: "spy.annual", title: "Pro", price: "$49.99", period: "year")
        ]

        private var entitlement: Entitlement
        private var continuations: [UUID: AsyncStream<Entitlement>.Continuation] = [:]

        init(entitlement: Entitlement = Entitlement()) {
            self.entitlement = entitlement
        }

        func entitlementStream() -> AsyncStream<Entitlement> {
            AsyncStream { continuation in
                let key = UUID()
                continuations[key] = continuation
                continuation.onTermination = { [weak self] _ in
                    Task { @MainActor in
                        self?.continuations[key] = nil
                    }
                }
                continuation.yield(entitlement)
            }
        }

        func setUser(_ uid: String?) async {}

        func purchase(productId: String) async throws {
            purchaseCalls.append(productId)
            if purchaseShouldFail { throw ServiceError() }
            entitlement = Entitlement(isPro: true, productId: productId)
            broadcast()
        }

        func restore() async throws {
            restoreCalls += 1
            broadcast()
        }

        func offerings() async throws -> [SubscriptionOffer] {
            if offeringsShouldFail { throw ServiceError() }
            return offers
        }

        private func broadcast() {
            for continuation in continuations.values {
                continuation.yield(entitlement)
            }
        }
    }

    /// Polls `condition` until it holds or the timeout elapses, then asserts.
    @MainActor
    private func waitUntil(
        timeout: TimeInterval = 2,
        _ message: String,
        _ condition: () -> Bool
    ) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTAssertTrue(condition(), message)
    }

    @MainActor
    private func makeStarted(
        service: SpySubscriptionService? = nil
    ) async -> (PaywallViewModel, SpySubscriptionService) {
        let service = service ?? SpySubscriptionService()
        let viewModel = PaywallViewModel(subscriptions: service)
        viewModel.start()
        await waitUntil("Offerings load") {
            viewModel.offers != nil
        }
        return (viewModel, service)
    }

    // MARK: - Offerings

    @MainActor
    func testOfferingsLoadedAndAnnualPreselected() async {
        let (viewModel, _) = await makeStarted()

        XCTAssertEqual(viewModel.offers?.count, 2)
        XCTAssertEqual(viewModel.selectedOfferId, "spy.annual",
                       "Annual (Best value) is the default selection")
        XCTAssertEqual(viewModel.selectedOffer?.period, "year")
    }

    @MainActor
    func testOfferingsFailureShowsErrorWithEmptyOffers() async {
        let service = SpySubscriptionService()
        service.offeringsShouldFail = true
        let (viewModel, _) = await makeStarted(service: service)

        XCTAssertEqual(viewModel.offers, [])
        XCTAssertNotNil(viewModel.errorMessage)
    }

    // MARK: - Purchase

    @MainActor
    func testPurchaseCallsServiceAndCompletesOnEntitlementFlip() async {
        let (viewModel, service) = await makeStarted()

        await viewModel.purchase()

        XCTAssertEqual(service.purchaseCalls, ["spy.annual"])
        await waitUntil("The pro entitlement emission completes the paywall") {
            viewModel.didUnlockPro
        }
        XCTAssertFalse(viewModel.isPurchasing)
        XCTAssertNil(viewModel.errorMessage)
    }

    @MainActor
    func testPurchaseSelectedMonthlyOffer() async {
        let (viewModel, service) = await makeStarted()

        viewModel.select(service.offers[0])
        await viewModel.purchase()

        XCTAssertEqual(service.purchaseCalls, ["spy.monthly"])
    }

    @MainActor
    func testPurchaseFailureSurfacesInlineErrorWithoutCompleting() async {
        let service = SpySubscriptionService()
        service.purchaseShouldFail = true
        let (viewModel, _) = await makeStarted(service: service)

        await viewModel.purchase()

        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.didUnlockPro)
        XCTAssertFalse(viewModel.isPurchasing)
    }

    @MainActor
    func testAlreadyProBaselineDoesNotAutoComplete() async {
        let service = SpySubscriptionService(entitlement: Entitlement(isPro: true))
        let (viewModel, _) = await makeStarted(service: service)

        await waitUntil("Baseline entitlement is consumed") {
            viewModel.isAlreadyPro
        }
        XCTAssertFalse(viewModel.didUnlockPro,
                       "An already-pro user managing their plan must not auto-dismiss")
    }

    // MARK: - Restore

    @MainActor
    func testRestoreCallsService() async {
        let (viewModel, service) = await makeStarted()

        await viewModel.restore()

        XCTAssertEqual(service.restoreCalls, 1)
        XCTAssertFalse(viewModel.isRestoring)
    }

    // MARK: - Demo mock integration

    /// The demo MockSubscriptionService must drive the same flow end to end:
    /// two offers (monthly $6.99 / annual $49.99), and purchase flips the
    /// entitlement to pro on the stream.
    @MainActor
    func testDemoMockSubscriptionServiceDrivesFullPurchaseFlow() async {
        let service = MockSubscriptionService()
        let viewModel = PaywallViewModel(subscriptions: service)
        viewModel.start()

        await waitUntil("Demo offerings load") {
            viewModel.offers != nil
        }
        XCTAssertEqual(viewModel.offers?.count, 2)
        XCTAssertEqual(viewModel.offers?.first(where: { $0.period == "month" })?.price, "$6.99")
        XCTAssertEqual(viewModel.offers?.first(where: { $0.period == "year" })?.price, "$49.99")

        await viewModel.purchase()

        await waitUntil(timeout: 3, "Demo purchase flips the entitlement to pro") {
            viewModel.didUnlockPro
        }
    }
}
