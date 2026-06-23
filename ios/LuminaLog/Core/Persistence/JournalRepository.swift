import Foundation

/// Errors surfaced by `JournalRepository` implementations.
enum JournalRepositoryError: LocalizedError {
    /// The targeted entry does not exist (e.g. it was deleted while an
    /// update was in flight).
    case entryNotFound(id: String)

    var errorDescription: String? {
        switch self {
        case .entryNotFound(let id):
            return "Journal entry \(id) does not exist."
        }
    }
}

/// Read/write access to the user's journal entries
/// (`journals` top-level collection, filtered by `userId`).
@MainActor
protocol JournalRepository: AnyObject {

    /// Live-updating stream of the most recent entries (newest first).
    /// Emits the current value immediately, then on every change.
    ///
    /// Streams never throw: backend errors are logged and the stream stays
    /// silent until the next good snapshot. Streams capture the user at
    /// creation and must be re-created on auth changes.
    func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]>

    /// One page of entries strictly older than `after` (newest first).
    /// Pass nil for the first page.
    func entries(after: Date?, limit: Int) async throws -> [JournalEntry]

    /// One-shot fetch of ALL of the signed-in user's entries (newest first),
    /// decrypted in-memory. Used by the Insights dashboard for whole-corpus
    /// analysis. Not a listener — a single read. Returns [] when signed out
    /// or the key is unavailable (same convention as `entries(after:)`).
    func fetchAllEntries() async throws -> [JournalEntry]

    /// Live-updating stream of a single entry; emits nil if it does not exist
    /// or is deleted.
    ///
    /// Streams never throw: backend errors are logged and the stream stays
    /// silent until the next good snapshot. Streams capture the user at
    /// creation and must be re-created on auth changes.
    func entry(id: String) -> AsyncStream<JournalEntry?>

    /// Create or overwrite an entry.
    func save(_ entry: JournalEntry) async throws

    /// Updates ONLY the provided non-nil AI fields on an existing entry.
    /// Throws `JournalRepositoryError.entryNotFound` if the document does
    /// not exist — it must NEVER recreate a deleted entry.
    func updateAIFields(
        id: String,
        summary: AIGeneration?,
        insights: AIGeneration?,
        prompts: AIPrompts?
    ) async throws

    /// Updates an entry's canonical text and appends audio attachments.
    /// Seals `content`, sets `contentEditedAt`, and array-unions
    /// `appendedMedia`. Throws `JournalRepositoryError.entryNotFound` if the
    /// document does not exist — it must NEVER recreate a deleted entry.
    func updateContent(
        id: String,
        content: String,
        wordCount: Int,
        contentEditedAt: Date,
        appendedMedia: [MediaItem]
    ) async throws

    /// Applies a user edit to an entry's title and content, appending an
    /// `EditRecord` to the edit history. `contentEditedAt` is set ONLY when the
    /// content changed (pass nil for a title-only edit, so the summary is not
    /// flagged stale). Throws `JournalRepositoryError.entryNotFound` if the
    /// document does not exist — it must NEVER recreate a deleted entry.
    func applyEntryEdit(
        id: String,
        title: String,
        content: String,
        wordCount: Int,
        contentEditedAt: Date?,
        edit: EditRecord
    ) async throws

    func delete(id: String) async throws

    /// Sets whether this entry is excluded from the shareable daily insights card.
    func setExcludeFromShare(entryId: String, value: Bool) async throws
}
