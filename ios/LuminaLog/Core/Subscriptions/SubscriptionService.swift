import Foundation

/// A purchasable subscription option shown on the paywall.
struct SubscriptionOffer: Equatable, Identifiable, Sendable {
    var id: String
    var title: String
    /// Localized display price, e.g. "$4.99".
    var price: String
    /// Billing period, e.g. "month" or "year".
    var period: String

    init(id: String, title: String, price: String, period: String) {
        self.id = id
        self.title = title
        self.price = price
        self.period = period
    }
}

/// Subscription state and purchases — RevenueCat in production,
/// an in-memory mock in demo mode.
protocol SubscriptionService: AnyObject {

    /// Emits the current entitlement immediately, then on every change.
    func entitlementStream() -> AsyncStream<Entitlement>

    func purchase(productId: String) async throws

    func restore() async throws

    func offerings() async throws -> [SubscriptionOffer]
}
