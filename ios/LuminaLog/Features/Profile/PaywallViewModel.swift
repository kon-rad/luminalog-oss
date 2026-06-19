import Foundation
import OSLog

/// Drives the LuminaLog Pro paywall sheet: loads offerings, tracks the
/// selected offer, and completes (dismisses) when the entitlement stream
/// flips to pro after a purchase or restore.
@MainActor
final class PaywallViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "paywall")

    /// nil while offerings are loading; empty when loading failed.
    @Published private(set) var offers: [SubscriptionOffer]?
    @Published var selectedOfferId: String?

    @Published private(set) var isPurchasing = false
    @Published private(set) var isRestoring = false
    @Published var errorMessage: String?

    /// Whether the user was already pro when the paywall opened.
    @Published private(set) var isAlreadyPro = false

    /// Set when the entitlement flips to pro *after* the baseline emission —
    /// the view observes this and dismisses.
    @Published private(set) var didUnlockPro = false

    /// How long, after `restore()` returns, to wait for a pro entitlement
    /// emission before concluding there were no purchases to restore.
    /// Tests shorten this to keep the no-purchases path fast.
    var restoreEntitlementDeadline: Duration = .seconds(5)

    private let subscriptions: SubscriptionService
    private var entitlementTask: Task<Void, Never>?
    private var hasStarted = false
    private var hasBaselineEntitlement = false

    init(subscriptions: SubscriptionService) {
        self.subscriptions = subscriptions
    }

    deinit {
        entitlementTask?.cancel()
    }

    // MARK: - Lifecycle

    /// Starts the entitlement stream and loads offerings. Idempotent.
    func start() {
        guard !hasStarted else { return }
        hasStarted = true

        entitlementTask = Task { [weak self] in
            guard let stream = self?.subscriptions.entitlementStream() else { return }
            for await entitlement in stream {
                guard let self, !Task.isCancelled else { return }
                self.handle(entitlement)
            }
        }

        Task { await loadOffers() }
    }

    /// The first emission is the baseline (an already-pro user managing their
    /// plan must not auto-dismiss); any later pro emission completes the flow.
    private func handle(_ entitlement: Entitlement) {
        if !hasBaselineEntitlement {
            hasBaselineEntitlement = true
            isAlreadyPro = entitlement.isPro
            return
        }
        if entitlement.isPro {
            didUnlockPro = true
        }
    }

    private func loadOffers() async {
        do {
            let loaded = try await subscriptions.offerings()
            offers = loaded
            if selectedOfferId == nil {
                // Annual is the highlighted "Best value" default.
                selectedOfferId = loaded.first(where: { $0.period == "year" })?.id
                    ?? loaded.first?.id
            }
        } catch {
            Self.logger.error("offerings failed: \(error.localizedDescription, privacy: .public)")
            offers = []
            errorMessage = "Subscription options couldn't be loaded. Please try again later."
        }
    }

    // MARK: - Selection

    var selectedOffer: SubscriptionOffer? {
        offers?.first { $0.id == selectedOfferId }
    }

    func select(_ offer: SubscriptionOffer) {
        selectedOfferId = offer.id
    }

    // MARK: - Offer codes

    /// Present the App Store code-redemption sheet (Apple Offer Codes). A
    /// successful redemption flips the entitlement via the stream, which then
    /// completes the paywall (or unlocks the gate) the same as a purchase.
    func redeemCode() {
        subscriptions.presentCodeRedemptionSheet()
    }

    // MARK: - Purchase / restore

    func purchase() async {
        guard let selectedOfferId, !isPurchasing else { return }
        isPurchasing = true
        defer { isPurchasing = false }
        errorMessage = nil
        do {
            try await subscriptions.purchase(productId: selectedOfferId)
            // Completion comes from the entitlement stream flipping to pro,
            // keeping demo, sandbox, and production paths identical.
        } catch {
            Self.logger.error("purchase failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "The purchase didn't go through — you haven't been charged. Please try again."
        }
    }

    func restore() async {
        guard !isRestoring, !isPurchasing else { return }
        isRestoring = true
        defer { isRestoring = false }
        errorMessage = nil
        do {
            try await subscriptions.restore()
            // The restored entitlement arrives via the stream — await a pro
            // emission with a bounded deadline (real networks can be slow);
            // only after the deadline passes do we declare no purchases.
            let deadline = ContinuousClock.now + restoreEntitlementDeadline
            while !didUnlockPro && !isAlreadyPro && ContinuousClock.now < deadline {
                try? await Task.sleep(for: .milliseconds(50))
            }
            if !didUnlockPro && !isAlreadyPro {
                errorMessage = "No previous purchases were found for this Apple ID."
            }
        } catch {
            Self.logger.error("restore failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Purchases couldn't be restored. Please try again."
        }
    }
}
