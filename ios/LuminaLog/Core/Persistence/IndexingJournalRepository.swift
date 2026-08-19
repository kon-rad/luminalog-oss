import Foundation
import OSLog

private let indexLog = Logger(subsystem: "com.konradgnat.luminalog", category: "indexing")

/// A `JournalRepository` decorator that keeps the client-side semantic index
/// (increment 1c-D / 19b) in sync with the entry lifecycle: after a create/edit
/// it indexes the entry, after a delete it removes it.
///
/// Every method forwards to `base` first and returns its result unchanged; the
/// indexing side-effect fires ONLY when `DevFlags.aiModel1` is ON, and it is
/// fire-and-forget (a detached `Task` whose failure is logged, never propagated)
/// so an indexing error can never block — or alter the outcome of — saving or
/// deleting an entry. With the flag OFF this type is a pure pass-through, so the
/// repository's observable behavior is byte-identical to using `base` directly.
///
/// Wrapping the repository (rather than sprinkling hooks across the many save
/// sites in `EntryProcessor` / `EntryFinalizer` / view models) gives a single
/// chokepoint through which every create, edit, and delete already flows.
@MainActor
final class IndexingJournalRepository: JournalRepository {

    private let base: JournalRepository
    private let coordinator: SemanticIndexCoordinating

    init(base: JournalRepository, coordinator: SemanticIndexCoordinating) {
        self.base = base
        self.coordinator = coordinator
    }

    // MARK: - Reads (pure pass-through)

    func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> {
        base.recentEntries(limit: limit)
    }

    func entries(after: Date?, limit: Int) async throws -> [JournalEntry] {
        try await base.entries(after: after, limit: limit)
    }

    func entriesToday(timezone: TimeZone) -> AsyncStream<[JournalEntry]> {
        base.entriesToday(timezone: timezone)
    }

    func fetchAllEntries() async throws -> [JournalEntry] {
        try await base.fetchAllEntries()
    }

    func entry(id: String) -> AsyncStream<JournalEntry?> {
        base.entry(id: id)
    }

    func countEntries(on date: Date, excluding draftId: String) async throws -> Int {
        try await base.countEntries(on: date, excluding: draftId)
    }

    // MARK: - Writes (forward, then index/remove when the flag is on)

    func save(_ entry: JournalEntry) async throws {
        try await base.save(entry)
        index(id: entry.id, text: entry.content, createdAt: entry.createdAt)
    }

    func updateContent(
        id: String,
        content: String,
        wordCount: Int,
        contentEditedAt: Date,
        appendedMedia: [MediaItem]
    ) async throws {
        try await base.updateContent(
            id: id, content: content, wordCount: wordCount,
            contentEditedAt: contentEditedAt, appendedMedia: appendedMedia
        )
        index(id: id, text: content, createdAt: nil)
    }

    func applyEntryEdit(
        id: String,
        title: String,
        content: String,
        wordCount: Int,
        contentEditedAt: Date?,
        edit: EditRecord
    ) async throws {
        try await base.applyEntryEdit(
            id: id, title: title, content: content, wordCount: wordCount,
            contentEditedAt: contentEditedAt, edit: edit
        )
        index(id: id, text: content, createdAt: nil)
    }

    func delete(id: String) async throws {
        try await base.delete(id: id)
        remove(id: id)
    }

    // MARK: - Unindexed writes (pure pass-through)

    /// AI fields don't change the user's searchable text, so no re-index.
    func updateAIFields(
        id: String,
        summary: AIGeneration?,
        insights: AIGeneration?,
        prompts: AIPrompts?
    ) async throws {
        try await base.updateAIFields(id: id, summary: summary, insights: insights, prompts: prompts)
    }

    /// Pass-through: a cognitive map is derived from content already indexed, so
    /// writing one never changes the RAG index.
    func updateCognitiveMap(id: String, map: CognitiveMapGeneration) async throws {
        try await base.updateCognitiveMap(id: id, map: map)
    }

    func setExcludeFromShare(entryId: String, value: Bool) async throws {
        try await base.setExcludeFromShare(entryId: entryId, value: value)
    }

    // MARK: - Fire-and-forget indexing side-effects

    /// Ship the entry for server-side (re)indexing. `createdAt` sets the entry's
    /// constellation day; the content-edit paths don't carry it, so it is resolved
    /// from the just-saved entry (its day never changes on edit) inside the task,
    /// falling back to now if the entry can't be read.
    private func index(id: String, text: String, createdAt: Date?) {
        guard DevFlags.aiModel1 else { return }
        Task {
            do {
                let created: Date
                if let createdAt {
                    created = createdAt
                } else {
                    created = (await self.resolveCreatedAt(id: id)) ?? Date()
                }
                try await self.coordinator.indexEntry(id: id, text: text, createdAt: created)
            } catch {
                indexLog.error("indexEntry(\(id, privacy: .public)) failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func remove(id: String) {
        guard DevFlags.aiModel1 else { return }
        let coordinator = self.coordinator
        Task {
            do {
                try await coordinator.removeEntry(id: id)
            } catch {
                indexLog.error("removeEntry(\(id, privacy: .public)) failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    /// First emission of the entry stream → its `createdAt`, or nil if absent.
    private func resolveCreatedAt(id: String) async -> Date? {
        for await entry in base.entry(id: id) { return entry?.createdAt }
        return nil
    }
}
