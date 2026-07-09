import XCTest
import CryptoKit
@testable import LuminaLog

// MARK: - Test doubles

/// Fixed-token provider so `ProxyAPIClient` can build authed requests offline.
private final class VectorStubTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

/// Captures the outgoing request (method, URL, body) and returns a canned JSON
/// response, so we can assert exactly what `ProxyVectorService` puts on the wire.
private final class VectorCapturingURLProtocol: URLProtocol {

    // Language mode 5.0: statics need no strict-concurrency isolation checks.
    nonisolated(unsafe) static var lastMethod: String?
    nonisolated(unsafe) static var lastURL: URL?
    nonisolated(unsafe) static var lastBody: Data?
    nonisolated(unsafe) static var responseJSON = Data("{}".utf8)

    static func reset() {
        lastMethod = nil
        lastURL = nil
        lastBody = nil
        responseJSON = Data("{}".utf8)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lastMethod = request.httpMethod
        Self.lastURL = request.url
        Self.lastBody = Self.readBody(from: request)
        let response = HTTPURLResponse(
            url: request.url!, statusCode: 200, httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.responseJSON)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func readBody(from request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: buffer.count)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}

// MARK: - Tests

final class ProxyVectorServiceTests: XCTestCase {

    private func makeService() -> ProxyVectorService {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [VectorCapturingURLProtocol.self]
        let session = URLSession(configuration: config)
        let api = ProxyAPIClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: VectorStubTokenProvider(),
            session: session
        )
        return ProxyVectorService(api: api)
    }

    override func setUp() {
        super.setUp()
        VectorCapturingURLProtocol.reset()
    }

    override func tearDown() {
        VectorCapturingURLProtocol.reset()
        super.tearDown()
    }

    // MARK: upsert → POST /v1/vectors/batch

    func testUpsertPostsBatchWithBody() async throws {
        let service = makeService()
        let items = [
            VectorSyncItem(entryId: "e1", blob: "blob1", dim: 768, model: "stub-embedder-v1"),
            VectorSyncItem(entryId: "e2", blob: "blob2", dim: 768, model: "stub-embedder-v1"),
        ]
        try await service.upsert(items)

        XCTAssertEqual(VectorCapturingURLProtocol.lastMethod, "POST")
        XCTAssertEqual(VectorCapturingURLProtocol.lastURL?.path, "/v1/vectors/batch")

        let body = try XCTUnwrap(VectorCapturingURLProtocol.lastBody)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let vectors = try XCTUnwrap(json["vectors"] as? [[String: Any]])
        XCTAssertEqual(vectors.count, 2)
        XCTAssertEqual(vectors[0]["entryId"] as? String, "e1")
        XCTAssertEqual(vectors[0]["blob"] as? String, "blob1")
        XCTAssertEqual(vectors[0]["dim"] as? Int, 768)
        XCTAssertEqual(vectors[0]["model"] as? String, "stub-embedder-v1")
        XCTAssertEqual(vectors[1]["entryId"] as? String, "e2")
    }

    func testUpsertEmptyIsNoOp() async throws {
        let service = makeService()
        try await service.upsert([])
        // No request should have gone out.
        XCTAssertNil(VectorCapturingURLProtocol.lastMethod)
    }

    // MARK: list → GET /v1/vectors

    func testListDecodesResponse() async throws {
        VectorCapturingURLProtocol.responseJSON = Data(#"""
        { "vectors": [
            { "entryId": "e1", "blob": "b1", "dim": 768, "model": "m", "updatedAt": "2026-07-07T00:00:00Z" },
            { "entryId": "e2", "blob": "b2", "dim": 768, "model": "m", "updatedAt": "2026-07-07T00:00:00Z" }
        ] }
        """#.utf8)

        let service = makeService()
        let items = try await service.list()

        XCTAssertEqual(VectorCapturingURLProtocol.lastMethod, "GET")
        XCTAssertEqual(VectorCapturingURLProtocol.lastURL?.path, "/v1/vectors")
        XCTAssertEqual(items, [
            VectorSyncItem(entryId: "e1", blob: "b1", dim: 768, model: "m"),
            VectorSyncItem(entryId: "e2", blob: "b2", dim: 768, model: "m"),
        ])
    }

    // MARK: delete → DELETE /v1/vectors/:entryId

    func testDeleteHitsEntryPath() async throws {
        let service = makeService()
        try await service.delete(entryId: "entry-123")

        XCTAssertEqual(VectorCapturingURLProtocol.lastMethod, "DELETE")
        XCTAssertEqual(VectorCapturingURLProtocol.lastURL?.path, "/v1/vectors/entry-123")
    }

    // MARK: Blob encoding round-trip

    func testBlobCodecRoundTrip() throws {
        let store = EncryptedVectorStore(dimension: 8)
        let dek = SymmetricKey(size: .bits256)
        let vector = EmbeddingVector((0..<8).map { Float($0) * 0.1 - 0.4 })
        let wrapped = try store.wrap(vector, dek: dek)

        let blob = VectorBlobCodec.encode(wrapped)
        let decoded = try XCTUnwrap(VectorBlobCodec.decode(blob))
        XCTAssertEqual(decoded, wrapped)

        // And it still decrypts back to the original vector.
        let reopened = try store.unwrap(decoded, dek: dek)
        XCTAssertEqual(reopened, vector)
    }

    func testBlobCodecRejectsGarbage() {
        XCTAssertNil(VectorBlobCodec.decode("not-base64-!!!"))
        XCTAssertNil(VectorBlobCodec.decode(Data("{\"nope\":1}".utf8).base64EncodedString()))
    }
}
