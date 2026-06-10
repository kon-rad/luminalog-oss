import Foundation

/// Read/write access to the user's journal entries
/// (`journals` top-level collection, filtered by `userId`).
protocol JournalRepository: AnyObject {

    /// Live-updating stream of the most recent entries (newest first).
    /// Emits the current value immediately, then on every change.
    func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]>

    /// One page of entries strictly older than `after` (newest first).
    /// Pass nil for the first page.
    func entries(after: Date?, limit: Int) async throws -> [JournalEntry]

    /// Live-updating stream of a single entry; emits nil if it does not exist
    /// or is deleted.
    func entry(id: String) -> AsyncStream<JournalEntry?>

    /// Create or overwrite an entry.
    func save(_ entry: JournalEntry) async throws

    func delete(id: String) async throws
}
