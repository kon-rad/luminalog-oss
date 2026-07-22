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

    /// Grace period before re-locking after a *transient* non-pro emission while
    /// already unlocked. RevenueCat briefly reports non-pro during a renewal — the
    /// old period expires moments before the renewal receipt validates (seen in the
    /// logs as an entitlement `expiresDate` earlier than the receipt's `signedDate`).
    /// Locking on that blip is catastrophic: `PaywallGate` structurally swaps
    /// `RootView` out, tearing down the whole app — cancelling in-flight view work
    /// like Journal Detail's entry-AI generation (which then fails with `cancelled`
    /// and never completes). Debounce so a momentary lapse doesn't lock; a genuinely
    /// lapsed subscriber stays non-pro past this window and then locks as before.
    var relockGrace: Duration = .seconds(10)

    private let subscriptions: SubscriptionService
    private let lastKnownProKey = "ll-last-known-pro"
    private var entitlementTask: Task<Void, Never>?
    private var timeoutTask: Task<Void, Never>?
    /// Pending debounced re-lock (see `relockGrace`); cancelled if pro returns first.
    private var relockTask: Task<Void, Never>?
    private var resolved = false
    private var hasStarted = false

    init(subscriptions: SubscriptionService) {
        self.subscriptions = subscriptions
    }

    deinit {
        entitlementTask?.cancel()
        timeoutTask?.cancel()
        relockTask?.cancel()
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

        if entitlement.isPro {
            // Pro (re)confirmed — cancel any pending re-lock and unlock.
            relockTask?.cancel()
            relockTask = nil
            UserDefaults.standard.set(true, forKey: lastKnownProKey)
            state = .unlocked
            return
        }

        // Non-pro emission.
        if state == .unlocked {
            // Debounce (see `relockGrace`): don't tear down a live session on a
            // transient renewal blip. Only lock if non-pro persists past the window.
            // Keep the first pending timer — repeated non-pro emissions don't restart
            // it (so the grace can't be extended indefinitely by a chatty stream).
            guard relockTask == nil else { return }
            relockTask = Task { [weak self] in
                guard let self else { return }
                try? await Task.sleep(for: self.relockGrace)
                guard !Task.isCancelled else { return }
                self.relockTask = nil
                UserDefaults.standard.set(false, forKey: self.lastKnownProKey)
                self.state = .locked
            }
        } else {
            // First resolution (or already locked): lock immediately, no grace —
            // a never-pro user should see the paywall at once.
            UserDefaults.standard.set(false, forKey: lastKnownProKey)
            state = .locked
        }
    }
}
