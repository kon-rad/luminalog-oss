import Foundation

/// Maps the subscription entitlement stream to a gate state for `PaywallGate`.
///
/// Fails open — treats a cached last-known-pro user as unlocked — if the stream
/// is slow to resolve, so a paying subscriber is never locked out of the app on
/// a flaky cold launch. RevenueCat's on-disk CustomerInfo cache normally emits
/// immediately (even offline), so the timeout backstop rarely fires.
@MainActor
final class PaywallGateViewModel: ObservableObject {

    enum State: Equatable { case checking, locked, unlocked }

    @Published private(set) var state: State = .checking

    /// How long to wait for a first emission before applying the fail-open backstop.
    var resolveTimeout: Duration = .seconds(4)

    private let subscriptions: SubscriptionService
    private let lastKnownProKey = "ll-last-known-pro"
    private var entitlementTask: Task<Void, Never>?
    private var timeoutTask: Task<Void, Never>?
    private var resolved = false
    private var hasStarted = false

    init(subscriptions: SubscriptionService) {
        self.subscriptions = subscriptions
    }

    deinit {
        entitlementTask?.cancel()
        timeoutTask?.cancel()
    }

    /// Starts the entitlement stream and the fail-open timeout. Idempotent.
    func start() {
        guard !hasStarted else { return }
        hasStarted = true

        timeoutTask = Task { [weak self] in
            guard let self else { return }
            try? await Task.sleep(for: self.resolveTimeout)
            guard !Task.isCancelled, !self.resolved else { return }
            // No emission in time: fail open only if we last saw a pro user.
            let lastKnownPro = UserDefaults.standard.bool(forKey: self.lastKnownProKey)
            self.state = lastKnownPro ? .unlocked : .locked
        }

        entitlementTask = Task { [weak self] in
            guard let stream = self?.subscriptions.entitlementStream() else { return }
            for await entitlement in stream {
                guard let self, !Task.isCancelled else { return }
                self.apply(entitlement)
            }
        }
    }

    private func apply(_ entitlement: Entitlement) {
        resolved = true
        timeoutTask?.cancel()
        UserDefaults.standard.set(entitlement.isPro, forKey: lastKnownProKey)
        state = entitlement.isPro ? .unlocked : .locked
    }
}
