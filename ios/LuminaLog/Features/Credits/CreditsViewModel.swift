import Foundation
import OSLog

/// Drives the credit store sheet: live balance, available packs, and pack purchase.
@MainActor
final class CreditsViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "credits-vm")

    @Published private(set) var balance: Int = 0
    @Published private(set) var packs: [CreditPack]? = nil
    @Published private(set) var isPurchasing = false
    @Published var errorMessage: String? = nil
    @Published private(set) var didPurchase = false

    private let credits: CreditService
    private var balanceTask: Task<Void, Never>?

    init(credits: CreditService) {
        self.credits = credits
    }

    deinit {
        balanceTask?.cancel()
    }

    func start() {
        balanceTask = Task { [weak self] in
            guard let self else { return }
            for await value in self.credits.balanceStream() {
                guard !Task.isCancelled else { return }
                self.balance = value
            }
        }
        Task { await loadPacks() }
    }

    func purchase(_ pack: CreditPack) async {
        guard !isPurchasing else { return }
        isPurchasing = true
        errorMessage = nil
        defer { isPurchasing = false }
        do {
            try await credits.purchase(packId: pack.id)
            didPurchase = true
        } catch {
            Self.logger.error("credit purchase failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = error.localizedDescription
        }
    }

    private func loadPacks() async {
        do {
            packs = try await credits.availablePacks()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
