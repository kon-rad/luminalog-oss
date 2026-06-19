import Foundation
import OSLog

/// Drives the credits sheet. The hosted RevenueCat paywall owns the purchase;
/// crediting happens server-side via webhook. After a purchase completes we show
/// an "Updating your balance…" state and poll Firestore until the new balance
/// lands (the snapshot listener also updates `balance` reactively).
@MainActor
final class CreditsViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "credits-vm")

    @Published private(set) var balance: Int = 0
    @Published private(set) var isUpdatingBalance = false
    @Published private(set) var didCompletePurchase = false
    @Published private(set) var balanceWasSlow = false

    private let credits: CreditService
    private var balanceTask: Task<Void, Never>?
    private var baseline = 0

    // Poll ~1.5s for up to ~21s before falling back to the snapshot listener.
    private let pollInterval: UInt64 = 1_500_000_000
    private let maxPolls = 14

    init(credits: CreditService) {
        self.credits = credits
    }

    deinit { balanceTask?.cancel() }

    func start() {
        balanceTask = Task { [weak self] in
            guard let self else { return }
            for await value in self.credits.balanceStream() {
                guard !Task.isCancelled else { return }
                self.balance = value
            }
        }
    }

    /// Called from the hosted paywall's purchase-completed callback.
    func beginBalanceRefresh() {
        guard !isUpdatingBalance else { return }
        baseline = balance
        isUpdatingBalance = true
        balanceWasSlow = false
        Task { await pollForCredit() }
    }

    private func pollForCredit() async {
        for _ in 0..<maxPolls {
            try? await Task.sleep(nanoseconds: pollInterval)
            let value = await credits.currentBalance()
            if value > baseline {
                balance = value
                finish(slow: false)
                return
            }
        }
        // Timed out — the snapshot listener will still catch up.
        finish(slow: true)
    }

    private func finish(slow: Bool) {
        isUpdatingBalance = false
        didCompletePurchase = true
        balanceWasSlow = slow
        Self.logger.info("credit balance refresh finished (slow: \(slow))")
    }
}
