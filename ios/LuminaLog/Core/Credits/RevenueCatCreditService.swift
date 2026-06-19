import FirebaseFirestore
import Foundation
import OSLog
import RevenueCat

/// `CreditService` backed by RevenueCat consumable IAP and Firestore balance storage.
///
/// Credits are stored in `users/{uid}.voiceCredits` (plaintext Int — not PII,
/// doesn't need field-level encryption). All balance mutations use Firestore
/// transactions to prevent double-spend or lost updates under concurrent writes.
@MainActor
final class RevenueCatCreditService: CreditService {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "credits")

    private let auth: AuthService
    private let db: Firestore

    init(auth: AuthService, db: Firestore = .firestore()) {
        self.auth = auth
        self.db = db
    }

    // MARK: - CreditService

    func balanceStream() -> AsyncStream<Int> {
        AsyncStream { continuation in
            guard let uid = self.auth.currentUserId else {
                continuation.yield(0)
                continuation.finish()
                return
            }
            let listener = self.db.collection("users").document(uid)
                .addSnapshotListener { snapshot, error in
                    if let error {
                        Self.logger.error("credit balance listener error: \(error.localizedDescription, privacy: .public)")
                        return
                    }
                    continuation.yield(snapshot?.data()?["voiceCredits"] as? Int ?? 0)
                }
            continuation.onTermination = { _ in listener.remove() }
        }
    }

    func currentBalance() async -> Int {
        guard let uid = auth.currentUserId else { return 0 }
        guard let snapshot = try? await db.collection("users").document(uid).getDocument() else { return 0 }
        return snapshot.data()?["voiceCredits"] as? Int ?? 0
    }

    func availablePacks() async throws -> [CreditPack] {
        let products = await Purchases.shared.products(CreditPack.productIds)
        return products.compactMap { product in
            guard let credits = CreditPack.creditsPerProduct[product.productIdentifier] else { return nil }
            return CreditPack(
                id: product.productIdentifier,
                credits: credits,
                price: product.localizedPriceString,
                popular: product.productIdentifier == "com.luminalog.credits.10"
            )
        }.sorted { $0.credits < $1.credits }
    }

    func purchase(packId: String) async throws {
        guard let credits = CreditPack.creditsPerProduct[packId] else {
            throw CreditError.packNotFound(packId)
        }
        let products = await Purchases.shared.products([packId])
        guard let product = products.first else {
            throw CreditError.packNotFound(packId)
        }
        do {
            _ = try await Purchases.shared.purchase(product: product)
            try await addCredits(credits)
            Self.logger.info("purchased \(credits) credits via \(packId, privacy: .public)")
        } catch {
            Self.logger.error("credit purchase failed: \(error.localizedDescription, privacy: .public)")
            throw CreditError.purchaseFailed(error.localizedDescription)
        }
    }

    func deductCredits(_ amount: Int) async throws {
        guard let uid = auth.currentUserId else { return }
        let ref = db.collection("users").document(uid)
        _ = try await db.runTransaction { transaction, errorPointer in
            let snapshot: DocumentSnapshot
            do { snapshot = try transaction.getDocument(ref) } catch {
                errorPointer?.pointee = error as NSError; return nil
            }
            let current = snapshot.data()?["voiceCredits"] as? Int ?? 0
            transaction.setData(["voiceCredits": max(0, current - amount)], forDocument: ref, merge: true)
            return nil
        }
        Self.logger.info("deducted \(amount) credit(s)")
    }

    func addCredits(_ amount: Int) async throws {
        guard let uid = auth.currentUserId else { return }
        let ref = db.collection("users").document(uid)
        _ = try await db.runTransaction { transaction, errorPointer in
            let snapshot: DocumentSnapshot
            do { snapshot = try transaction.getDocument(ref) } catch {
                errorPointer?.pointee = error as NSError; return nil
            }
            let current = snapshot.data()?["voiceCredits"] as? Int ?? 0
            transaction.setData(["voiceCredits": current + amount], forDocument: ref, merge: true)
            return nil
        }
        Self.logger.info("added \(amount) credit(s)")
    }
}
