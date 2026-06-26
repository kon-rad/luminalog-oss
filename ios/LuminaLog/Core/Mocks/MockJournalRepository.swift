import Foundation

/// In-memory `JournalRepository` for demo mode and tests.
/// Streams re-emit whenever the backing store changes.
@MainActor
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
                // onTermination runs off the main actor; hop back before
                // touching main-actor state.
                Task { @MainActor in
                    self?.listContinuations[key] = nil
                }
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

    func fetchAllEntries() async throws -> [JournalEntry] {
        // `store` is kept sorted newest-first.
        store
    }

    func entry(id: String) -> AsyncStream<JournalEntry?> {
        AsyncStream { continuation in
            let key = UUID()
            entryContinuations[key] = (id, continuation)
            continuation.onTermination = { [weak self] _ in
                // onTermination runs off the main actor; hop back before
                // touching main-actor state.
                Task { @MainActor in
                    self?.entryContinuations[key] = nil
                }
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

    func updateAIFields(
        id: String,
        summary: AIGeneration?,
        insights: AIGeneration?,
        prompts: AIPrompts?
    ) async throws {
        guard let index = store.firstIndex(where: { $0.id == id }) else {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
        if let summary { store[index].summary = summary }
        if let insights { store[index].insights = insights }
        if let prompts { store[index].prompts = prompts }
        broadcast(changedId: id)
    }

    func updateContent(
        id: String,
        content: String,
        wordCount: Int,
        contentEditedAt: Date,
        appendedMedia: [MediaItem]
    ) async throws {
        guard let index = store.firstIndex(where: { $0.id == id }) else {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
        store[index].content = content
        store[index].wordCount = wordCount
        store[index].contentEditedAt = contentEditedAt
        store[index].media.append(contentsOf: appendedMedia)
        broadcast(changedId: id)
    }

    func applyEntryEdit(
        id: String,
        title: String,
        content: String,
        wordCount: Int,
        contentEditedAt: Date?,
        edit: EditRecord
    ) async throws {
        guard let index = store.firstIndex(where: { $0.id == id }) else {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
        store[index].title = title
        store[index].content = content
        store[index].wordCount = wordCount
        if let contentEditedAt { store[index].contentEditedAt = contentEditedAt }
        store[index].editHistory.append(edit)
        broadcast(changedId: id)
    }

    func delete(id: String) async throws {
        store.removeAll { $0.id == id }
        broadcast(changedId: id)
    }

    func setExcludeFromShare(entryId: String, value: Bool) async throws {
        guard let index = store.firstIndex(where: { $0.id == entryId }) else { return }
        store[index].excludeFromShare = value
        broadcast(changedId: entryId)
    }

    func countEntries(on date: Date, excluding draftId: String) async throws -> Int {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: date)
        guard let end = calendar.date(byAdding: .day, value: 1, to: start) else { return 0 }
        return store.filter { entry in
            entry.id != draftId && entry.createdAt >= start && entry.createdAt < end
        }.count
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
