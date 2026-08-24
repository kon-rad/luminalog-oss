import Foundation
import RevenueCat

/// Errors specific to subscription purchases.
enum SubscriptionError: LocalizedError {
    case productNotFound(String)

    var errorDescription: String? {
        switch self {
        case .productNotFound(let id):
            return "Subscription product \(id) was not found."
        }
    }
}

/// `SubscriptionService` wrapping the RevenueCat Purchases SDK.
///
/// Only instantiated when a RevenueCat API key is present in Info.plist
/// (`REVENUECAT_API_KEY`); otherwise DI falls back to the mock.
@MainActor
final class RevenueCatSubscriptionService: SubscriptionService {

    /// The single entitlement defined in the spec (§2.5).
    static let proEntitlementId = "pro"

    init(apiKey: String, appUserId: String?) {
        if !Purchases.isConfigured {
            // appUserID = firebaseUid keeps RevenueCat/Firebase/proxy identities aligned.
            Purchases.configure(withAPIKey: apiKey, appUserID: appUserId)
        }
    }

    // MARK: - SubscriptionService

    func entitlementStream() -> AsyncStream<Entitlement> {
        AsyncStream { continuation in
            let task = Task {
                for await info in Purchases.shared.customerInfoStream {
                    continuation.yield(Self.entitlement(from: info))
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// Align the RevenueCat identity with the signed-in Firebase user.
    ///
    /// Honest caveat: configure-time `appUserID` only captures whoever was
    /// signed in at launch. The identity is truly aligned only once this is
    /// wired to auth-state changes (sign-in → `setUser(uid)`, sign-out →
    /// `setUser(nil)`), which happens in the auth task (Task 4).
    func setUser(_ uid: String?) async {
        guard Purchases.isConfigured else { return }
        do {
            if let uid {
                _ = try await Purchases.shared.logIn(uid)
            } else {
                _ = try await Purchases.shared.logOut()
            }
        } catch {
            // logOut throws for already-anonymous users; identity errors are
            // non-fatal, and the entitlement stream keeps reflecting reality.
        }
    }

    func purchase(productId: String) async throws {
        let products = await Purchases.shared.products([productId])
        guard let product = products.first else {
            throw SubscriptionError.productNotFound(productId)
        }
        _ = try await Purchases.shared.purchase(product: product)
    }

    func restore() async throws {
        _ = try await Purchases.shared.restorePurchases()
    }

    func presentCodeRedemptionSheet() {
        // Apple Offer Codes: opens the App Store redemption sheet. On success
        // RevenueCat refreshes CustomerInfo and the entitlement stream flips.
        Purchases.shared.presentCodeRedemptionSheet()
    }

    func showManageSubscriptions() async throws {
        guard Purchases.isConfigured else { return }
        try await Purchases.shared.showManageSubscriptions()
    }

    // MARK: - Mapping

    private static func entitlement(from info: CustomerInfo) -> Entitlement {
        let pro = info.entitlements[proEntitlementId]
        return Entitlement(
            isPro: pro?.isActive == true,
            productId: pro?.productIdentifier,
            expiresAt: pro?.expirationDate,
            updatedAt: Date(),
            store: store(from: pro?.store),
            managementURL: info.managementURL
        )
    }

    /// RevenueCat's `Store` to our shared label. The default case is deliberate:
    /// RevenueCat adds stores (external, paddle, galaxy) faster than this app
    /// ships, and an unrecognized one must degrade to "not manageable in the
    /// app" rather than misroute someone to Apple's subscriptions page.
    private static func store(from store: RevenueCat.Store?) -> EntitlementStore {
        switch store {
        case .appStore: return .appStore
        case .macAppStore: return .macAppStore
        case .playStore: return .playStore
        case .stripe: return .stripe
        case .rcBilling: return .rcBilling
        case .promotional: return .promotional
        case .external: return .external
        case .paddle: return .paddle
        default: return .unknown
        }
    }
}
