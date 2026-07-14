import Foundation

/// One search hit from `POST /v1/rag/search`.
struct ChunkRef: Equatable {
    let entryId: String
    let chunkIndex: Int
    let score: Double
}

/// Server RAG surface. Chunking happens on the client (`JournalChunker`); this only
/// ships chunks to be embedded/stored server-side and returns chunk references. The
/// server holds the vector index; the client never stores vectors.
protocol RagServing {
    func index(entryId: String, type: String, dayIndex: Int, wordCount: Int, chunks: [String]) async throws
    func search(query: String, topK: Int) async throws -> [ChunkRef]
    func delete(entryId: String) async throws
}

/// Narrow seam over `ProxyAPIClient`'s Codable methods so `RagService` is unit-testable
/// without the network. `ProxyAPIClient` satisfies this via a retroactive conformance
/// (its `put(path:body: some Encodable)` / `post<T>(path:body: some Encodable) -> T` /
/// `delete(path:)` match these requirements 1:1).
protocol RagAPI {
    func put<B: Encodable>(path: String, body: B) async throws
    func post<T: Decodable, B: Encodable>(path: String, body: B) async throws -> T
    func delete(path: String) async throws
}

extension ProxyAPIClient: RagAPI {}

final class RagService: RagServing {
    private let api: RagAPI
    init(api: RagAPI) { self.api = api }

    // MARK: - DTOs

    /// `PUT /v1/rag/index` body.
    private struct IndexBody: Encodable {
        let entryId: String
        let type: String
        let dayIndex: Int
        let wordCount: Int
        let chunks: [String]
    }

    /// `POST /v1/rag/search` body.
    private struct SearchBody: Encodable {
        let queryText: String
        let topK: Int
    }

    /// `POST /v1/rag/search` response: `{ hits: [{ entryId, chunkIndex, score }] }`.
    private struct SearchResponse: Decodable {
        let hits: [Hit]
        struct Hit: Decodable {
            let entryId: String
            let chunkIndex: Int
            let score: Double
        }
    }

    // MARK: - RagServing

    func index(entryId: String, type: String, dayIndex: Int, wordCount: Int, chunks: [String]) async throws {
        try await api.put(
            path: "/v1/rag/index",
            body: IndexBody(entryId: entryId, type: type, dayIndex: dayIndex, wordCount: wordCount, chunks: chunks)
        )
    }

    func search(query: String, topK: Int) async throws -> [ChunkRef] {
        let res: SearchResponse = try await api.post(
            path: "/v1/rag/search",
            body: SearchBody(queryText: query, topK: topK)
        )
        return res.hits.map { ChunkRef(entryId: $0.entryId, chunkIndex: $0.chunkIndex, score: $0.score) }
    }

    func delete(entryId: String) async throws {
        let encoded = entryId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? entryId
        try await api.delete(path: "/v1/rag/\(encoded)")
    }
}
