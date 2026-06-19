import Foundation

/// In-memory `CreditService` for demo mode — purchases succeed instantly.
@MainActor
final class MockCreditService: CreditService {

    private var balance: Int
    private var continuations: [UUID: AsyncStream<Int>.Continuation] = [:]

    init(balance: Int = 10) {
        self.balance = balance
    }

    // MARK: - CreditService

    func balanceStream() -> AsyncStream<Int> {
        AsyncStream { continuation in
            let key = UUID()
            continuations[key] = continuation
            continuation.yield(balance)
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in self?.continuations[key] = nil }
            }
        }
    }

    func currentBalance() async -> Int { balance }

    func deductCredits(_ amount: Int) async throws {
        balance = max(0, balance - amount)
        broadcast(balance)
    }

    /// Test-only: simulate the server webhook crediting the balance.
    func simulateServerCredit(_ amount: Int) {
        balance += amount
        broadcast(balance)
    }

    private func broadcast(_ value: Int) {
        for continuation in continuations.values { continuation.yield(value) }
    }
}
