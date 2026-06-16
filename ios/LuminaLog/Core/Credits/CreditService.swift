import Foundation

/// Errors surfaced by `CreditService` implementations.
enum CreditError: LocalizedError {
    case insufficientCredits(available: Int, required: Int)
    case packNotFound(String)
    case purchaseFailed(String)

    var errorDescription: String? {
        switch self {
        case .insufficientCredits(let available, let required):
            return "You need \(required) credit\(required == 1 ? "" : "s") but only have \(available). Top up to continue."
        case .packNotFound(let id):
            return "Credit pack \(id) was not found."
        case .purchaseFailed(let msg):
            return "Purchase failed: \(msg)"
        }
    }
}

/// Voice call credit balance and one-time pack purchases.
///
/// Credits are consumed per minute of VAPI voice call time. They are separate
/// from the subscription — both free and pro users can buy credit packs.
/// 1 credit = 1 minute of call time (VAPI cost $0.09/min × 1.25 margin).
@MainActor
protocol CreditService: AnyObject {

    /// Live-updating stream of the current credit balance.
    /// Emits immediately with the current value, then on every change.
    func balanceStream() -> AsyncStream<Int>

    /// Snapshot of the current balance (single Firestore read).
    func currentBalance() async -> Int

    /// Fetch available credit packs from RevenueCat / StoreKit.
    func availablePacks() async throws -> [CreditPack]

    /// Purchase a pack by product ID; atomically adds credits on success.
    func purchase(packId: String) async throws

    /// Atomically deduct `amount` credits; clamps to zero rather than going negative.
    func deductCredits(_ amount: Int) async throws

    /// Atomically add `amount` credits (called internally after purchase).
    func addCredits(_ amount: Int) async throws
}
