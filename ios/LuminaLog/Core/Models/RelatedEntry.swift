import Foundation

/// A neighbor surfaced on the Journal Detail "Related" tab — decoded from
/// `POST /v1/rag/related`. The server returns titles/snippets already decrypted.
struct RelatedEntry: Codable, Equatable, Identifiable, Sendable {
    var journalId: String
    var title: String
    var type: JournalType
    var date: String
    var snippet: String
    var score: Double

    var id: String { journalId }
}
