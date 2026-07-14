import XCTest
@testable import LuminaLog

private final class FakeRagAPI: RagAPI, @unchecked Sendable {
    var puts: [(path: String, body: Data)] = []
    var posts: [String] = []
    var deletes: [String] = []
    /// Canned `POST /v1/rag/search` response the generic `post` decodes into `T`.
    var searchResponseJSON = #"{"hits":[{"entryId":"e1","chunkIndex":2,"score":0.8},{"entryId":"e2","chunkIndex":0,"score":0.5}]}"#

    func put<B: Encodable>(path: String, body: B) async throws {
        puts.append((path, try JSONEncoder().encode(body)))
    }
    func post<T: Decodable, B: Encodable>(path: String, body: B) async throws -> T {
        posts.append(path)
        return try JSONDecoder().decode(T.self, from: Data(searchResponseJSON.utf8))
    }
    func delete(path: String) async throws { deletes.append(path) }
}

final class RagServiceTests: XCTestCase {

    func testIndexEncodesBodyToIndexPath() async throws {
        let api = FakeRagAPI()
        try await RagService(api: api).index(entryId: "e1", type: "text", dayIndex: 3, wordCount: 9, chunks: ["a", "b"])
        XCTAssertEqual(api.puts.first?.path, "/v1/rag/index")
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: api.puts[0].body) as? [String: Any])
        XCTAssertEqual(json["entryId"] as? String, "e1")
        XCTAssertEqual(json["dayIndex"] as? Int, 3)
        XCTAssertEqual(json["chunks"] as? [String], ["a", "b"])
    }

    func testSearchReturnsChunkRefs() async throws {
        let refs = try await RagService(api: FakeRagAPI()).search(query: "hi", topK: 8)
        XCTAssertEqual(refs, [
            ChunkRef(entryId: "e1", chunkIndex: 2, score: 0.8),
            ChunkRef(entryId: "e2", chunkIndex: 0, score: 0.5),
        ])
    }

    func testDeletePercentEncodesEntryId() async throws {
        let api = FakeRagAPI()
        try await RagService(api: api).delete(entryId: "a b")
        XCTAssertEqual(api.deletes.first, "/v1/rag/a%20b")
    }
}
