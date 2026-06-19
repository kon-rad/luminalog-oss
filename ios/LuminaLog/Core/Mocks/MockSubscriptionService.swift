import Foundation

/// In-memory `SubscriptionService` for demo mode — purchases succeed instantly.
@MainActor
final class MockSubscriptionService: SubscriptionService {

    private var entitlement: Entitlement
    private var continuations: [UUID: AsyncStream<Entitlement>.Continuation] = [:]

    init(entitlement: Entitlement = Entitlement()) {
        self.entitlement = entitlement
    }

    // MARK: - SubscriptionService

    func entitlementStream() -> AsyncStream<Entitlement> {
        AsyncStream { continuation in
            let key = UUID()
            continuations[key] = continuation
            continuation.onTermination = { [weak self] _ in
                // onTermination runs off the main actor; hop back before
                // touching main-actor state.
                Task { @MainActor in
                    self?.continuations[key] = nil
                }
            }
            continuation.yield(entitlement)
        }
    }

    /// Every `setUser` argument in call order — lets tests assert that the
    /// session keeps the subscription identity in sync with auth changes.
    private(set) var setUserCalls: [String?] = []

    func setUser(_ uid: String?) async {
        // Demo mode has no external subscription identity; just record the call.
        setUserCalls.append(uid)
    }

    func purchase(productId: String) async throws {
        try? await Task.sleep(nanoseconds: 700_000_000)
        entitlement = Entitlement(
            isPro: true,
            productId: productId,
            expiresAt: Calendar.current.date(byAdding: .month, value: 1, to: Date()),
            updatedAt: Date()
        )
        broadcast()
    }

    func restore() async throws {
        try? await Task.sleep(nanoseconds: 500_000_000)
        broadcast()
    }

    func presentCodeRedemptionSheet() {
        // Demo mode has no App Store; redemption is a no-op.
    }

    // MARK: - Broadcast

    private func broadcast() {
        for continuation in continuations.values {
            continuation.yield(entitlement)
        }
    }
}
