import Foundation

/// In-memory `JournalRepository` for demo mode and tests.
/// Streams re-emit whenever the backing store changes.
final class MockJournalRepository: JournalRepository {

    private var store: [JournalEntry]

    private var listContinuations: [UUID: (limit: Int, continuation: AsyncStream<[JournalEntry]>.Continuation)] = [:]
    private var entryContinuations: [UUID: (id: String, continuation: AsyncStream<JournalEntry?>.Continuation)] = [:]

    init(entries: [JournalEntry] = MockData.journalEntries) {
        store = entries.sorted { $0.createdAt > $1.createdAt }
    }

    // MARK: - JournalRepository

    func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> {
        AsyncStream { continuation in
            let key = UUID()
            listContinuations[key] = (limit, continuation)
            continuation.onTermination = { [weak self] _ in
                self?.listContinuations[key] = nil
            }
            continuation.yield(Array(store.prefix(limit)))
        }
    }

    func entries(after: Date?, limit: Int) async throws -> [JournalEntry] {
        let page = store
            .filter { entry in
                guard let after else { return true }
                return entry.createdAt < after
            }
            .prefix(limit)
        return Array(page)
    }

    func entry(id: String) -> AsyncStream<JournalEntry?> {
        AsyncStream { continuation in
            let key = UUID()
            entryContinuations[key] = (id, continuation)
            continuation.onTermination = { [weak self] _ in
                self?.entryContinuations[key] = nil
            }
            continuation.yield(store.first { $0.id == id })
        }
    }

    func save(_ entry: JournalEntry) async throws {
        if let index = store.firstIndex(where: { $0.id == entry.id }) {
            store[index] = entry
        } else {
            store.append(entry)
        }
        store.sort { $0.createdAt > $1.createdAt }
        broadcast(changedId: entry.id)
    }

    func delete(id: String) async throws {
        store.removeAll { $0.id == id }
        broadcast(changedId: id)
    }

    // MARK: - Broadcast

    private func broadcast(changedId: String) {
        for (_, value) in listContinuations {
            value.continuation.yield(Array(store.prefix(value.limit)))
        }
        for (_, value) in entryContinuations where value.id == changedId {
            value.continuation.yield(store.first { $0.id == changedId })
        }
    }
}
