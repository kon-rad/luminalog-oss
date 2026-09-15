import Foundation

/// In-memory `EncouragementRepository` for mock wiring and previews. Mirrors the
/// Firestore implementation's ordering and filtering rules so the coordinator
/// behaves the same way off the network.
@MainActor
final class InMemoryEncouragementRepository: EncouragementRepository {

    private var stored: [EncouragementMessage] = []
    private var batchDateKeys: Set<String> = []

    func hasBatch(forDateKey dateKey: String) async throws -> Bool {
        batchDateKeys.contains(dateKey)
    }

    func save(_ messages: [EncouragementMessage]) async throws {
        stored.append(contentsOf: messages)
        for message in messages {
            batchDateKeys.insert(EncouragementIds.dateKeyPrefix(message.id))
        }
    }

    func messages(forDateKey dateKey: String) async throws -> [EncouragementMessage] {
        stored.filter { EncouragementIds.dateKeyPrefix($0.id) == dateKey }
    }

    func markDelivered(id: String, at date: Date) async throws {
        guard let index = stored.firstIndex(where: { $0.id == id }) else { return }
        stored[index].deliveredAt = date
    }

    func recentDelivered(limit: Int, before now: Date, after lastDeliveredAt: Date?) async throws -> [EncouragementMessage] {
        let delivered = stored
            .filter { guard let at = $0.deliveredAt else { return false }; return at <= now }
            .sorted { $0.deliveredAt! > $1.deliveredAt! }
        let remaining = lastDeliveredAt.map { cursor in delivered.drop { $0.deliveredAt! >= cursor } } ?? ArraySlice(delivered)
        return Array(remaining.prefix(limit))
    }
}
