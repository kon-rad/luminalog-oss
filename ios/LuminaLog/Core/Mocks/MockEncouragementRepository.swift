import Foundation

/// In-memory `EncouragementRepository` for mock wiring and previews. Mirrors the
/// Firestore implementation's ordering and filtering rules so the coordinator
/// behaves the same way off the network.
@MainActor
final class InMemoryEncouragementRepository: EncouragementRepository {

    private var stored: [EncouragementMessage] = []
    private var batchDateKeys: Set<String> = []

    func undelivered() async throws -> [EncouragementMessage] {
        stored.filter { !$0.isDelivered }.sorted { $0.id < $1.id }
    }

    func hasBatch(forDateKey dateKey: String) async throws -> Bool {
        batchDateKeys.contains(dateKey)
    }

    func save(_ messages: [EncouragementMessage]) async throws {
        stored.append(contentsOf: messages)
        for message in messages {
            batchDateKeys.insert(EncouragementIds.dateKeyPrefix(message.id))
        }
    }

    func markDelivered(id: String, at date: Date) async throws {
        guard let index = stored.firstIndex(where: { $0.id == id }) else { return }
        stored[index].deliveredAt = date
    }

    func deleteExpired(createdBefore date: Date) async throws {
        stored.removeAll { !$0.isDelivered && $0.createdAt < date }
    }
}
