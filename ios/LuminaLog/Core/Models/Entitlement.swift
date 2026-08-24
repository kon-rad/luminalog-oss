import Foundation

/// Where a subscription is billed, and therefore who is allowed to cancel it.
///
/// Raw values match the server's `entitlement.source` labels (`sourceFromStore`
/// in `server/src/routes/revenuecat.ts`) and the RevenueCat Web SDK's `Store`
/// union, so iOS, web, and the server all speak one vocabulary.
enum EntitlementStore: String, Codable, Equatable, Sendable {
    case appStore = "app_store"
    case macAppStore = "mac_app_store"
    case playStore = "play_store"
    case stripe
    case rcBilling = "rc_billing"
    case promotional
    case external
    case paddle
    case unknown

    /// True for the stores Apple requires be managed in the system sheet.
    var isApple: Bool {
        self == .appStore || self == .macAppStore
    }
}

/// Subscription entitlement: a mirror of RevenueCat state
/// (`users/{uid}/entitlements/current` in Firestore, proxy-written).
struct Entitlement: Codable, Equatable, Sendable {
    var isPro: Bool
    var productId: String?
    var expiresAt: Date?
    var updatedAt: Date
    /// Which rail billed this subscription. Drives where "Manage subscription"
    /// sends the user (design 2026-08-23, section 3).
    var store: EntitlementStore
    /// RevenueCat's management link for this customer. The customer portal for
    /// a Web Billing subscription, Apple's subscriptions page for an App Store
    /// one, and nil when there is nothing to manage.
    var managementURL: URL?

    init(
        isPro: Bool = false,
        productId: String? = nil,
        expiresAt: Date? = nil,
        updatedAt: Date = Date(),
        store: EntitlementStore = .unknown,
        managementURL: URL? = nil
    ) {
        self.isPro = isPro
        self.productId = productId
        self.expiresAt = expiresAt
        self.updatedAt = updatedAt
        self.store = store
        self.managementURL = managementURL
    }
}
