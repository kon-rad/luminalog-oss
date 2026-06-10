import Foundation

/// Subscription entitlement — mirror of RevenueCat state
/// (`users/{uid}/entitlements/current` in Firestore, proxy-written).
struct Entitlement: Codable, Equatable, Sendable {
    var isPro: Bool
    var productId: String?
    var expiresAt: Date?
    var updatedAt: Date

    init(
        isPro: Bool = false,
        productId: String? = nil,
        expiresAt: Date? = nil,
        updatedAt: Date = Date()
    ) {
        self.isPro = isPro
        self.productId = productId
        self.expiresAt = expiresAt
        self.updatedAt = updatedAt
    }
}
