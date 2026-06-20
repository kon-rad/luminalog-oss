import Foundation

/// One entry node in the constellation graph. `id` is the journal entry id.
struct GraphNode: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let title: String
    let date: String
    let type: String
    let degree: Int
}

/// An undirected similarity edge between two entries (`value` = cosine score).
struct GraphLink: Codable, Equatable, Sendable {
    let source: String
    let target: String
    let value: Double
}

/// The whole-corpus similarity graph returned by `POST /v1/rag/graph`.
struct JournalGraph: Codable, Equatable, Sendable {
    let nodes: [GraphNode]
    let links: [GraphLink]
}
