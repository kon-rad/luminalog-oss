import Foundation

/// Subscription state and purchases — RevenueCat in production,
/// an in-memory mock in demo mode.
@MainActor
protocol SubscriptionService: AnyObject {

    /// Emits the current entitlement immediately, then on every change.
    func entitlementStream() -> AsyncStream<Entitlement>

    /// Align the subscription identity with the signed-in user. Call with the
    /// uid on sign-in and nil on sign-out (wired to auth-state changes in the
    /// auth task). Until this is called the identity may be anonymous/stale.
    func setUser(_ uid: String?) async

    func purchase(productId: String) async throws

    func restore() async throws

    /// Present the App Store code-redemption sheet (Apple Offer Codes). A
    /// successful redemption flips the entitlement via the customer-info stream.
    func presentCodeRedemptionSheet()
}
