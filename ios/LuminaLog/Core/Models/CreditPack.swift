import Foundation

/// A one-time purchasable credit pack shown on the credit store screen.
/// 1 credit = $1 = 6 minutes of VAPI voice call time (see docs/PRICING.md).
struct CreditPack: Equatable, Identifiable, Sendable {
    var id: String       // App Store product identifier
    var credits: Int     // credits awarded on purchase
    var price: String    // localized display price from StoreKit
    var popular: Bool

    /// Minutes of voice call time per credit (authoritative rate — docs/PRICING.md).
    static let minutesPerCredit = 6

    /// Minutes of voice call time this pack provides.
    var minutes: Int { credits * Self.minutesPerCredit }

    /// All product IDs used to fetch from RevenueCat / StoreKit.
    static let productIds: [String] = [
        "com.luminalog.credits.5",
        "com.luminalog.credits.10",
        "com.luminalog.credits.20",
        "com.luminalog.credits.50",
    ]

    /// Credits awarded per product identifier.
    static let creditsPerProduct: [String: Int] = [
        "com.luminalog.credits.5":  5,
        "com.luminalog.credits.10": 10,
        "com.luminalog.credits.20": 20,
        "com.luminalog.credits.50": 50,
    ]
}
