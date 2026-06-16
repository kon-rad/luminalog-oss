import Foundation

/// A one-time purchasable credit pack shown on the credit store screen.
/// 1 credit = 1 minute of VAPI voice call time.
struct CreditPack: Equatable, Identifiable, Sendable {
    var id: String       // App Store product identifier
    var credits: Int     // minutes awarded on purchase
    var price: String    // localized display price from StoreKit
    var popular: Bool

    /// All product IDs used to fetch from RevenueCat / StoreKit.
    static let productIds: [String] = [
        "com.luminalog.credits.60",
        "com.luminalog.credits.150",
        "com.luminalog.credits.300",
    ]

    /// Credits awarded per product identifier.
    static let creditsPerProduct: [String: Int] = [
        "com.luminalog.credits.60": 60,
        "com.luminalog.credits.150": 150,
        "com.luminalog.credits.300": 300,
    ]
}
