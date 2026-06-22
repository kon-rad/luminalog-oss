import Foundation

/// A result from `POST /v1/rag/search/keyword` or `/semantic`.
/// The server returns titles and snippets already decrypted.
struct SearchResult: Codable, Equatable, Identifiable, Sendable {
    var journalId: String
    var title: String
    var type: JournalType
    var date: String
    /// Decrypted text snippet (~200 chars around the first match).
    var snippet: String
    /// Cosine similarity 0–1 for semantic results; 0.0 for keyword results.
    var score: Double

    var id: String { journalId }
}
