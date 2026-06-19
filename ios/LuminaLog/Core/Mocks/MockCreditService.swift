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

    func availablePacks() async throws -> [CreditPack] {
        [
            CreditPack(id: "com.konradgnat.luminalog.credits.60",  credits: 60,  price: "$9.99",  popular: false),
            CreditPack(id: "com.konradgnat.luminalog.credits.150", credits: 150, price: "$24.99", popular: true),
            CreditPack(id: "com.konradgnat.luminalog.credits.300", credits: 300, price: "$49.99", popular: false),
        ]
    }

    func purchase(packId: String) async throws {
        try? await Task.sleep(nanoseconds: 700_000_000)
        let packs = try await availablePacks()
        guard let pack = packs.first(where: { $0.id == packId }) else {
            throw CreditError.packNotFound(packId)
        }
        balance += pack.credits
        broadcast(balance)
    }

    func deductCredits(_ amount: Int) async throws {
        balance = max(0, balance - amount)
        broadcast(balance)
    }

    func addCredits(_ amount: Int) async throws {
        balance += amount
        broadcast(balance)
    }

    private func broadcast(_ value: Int) {
        for continuation in continuations.values { continuation.yield(value) }
    }
}
