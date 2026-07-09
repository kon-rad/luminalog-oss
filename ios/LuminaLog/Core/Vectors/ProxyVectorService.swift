import Foundation

/// One encrypted vector row as it crosses the wire between the client and the
/// server's `/v1/vectors` endpoints (increment 1c-D). The `blob` is an opaque,
/// DEK-sealed envelope — the server stores and returns it verbatim and never sees
/// the plaintext embedding (zero-knowledge).
///
/// A value type (not a tuple) so it is `Equatable` for test assertions and can back
/// both the request and response DTOs. `dim`/`model` travel alongside the blob so a
/// future re-embed / dimension migration can detect stale rows without decrypting.
struct VectorSyncItem: Equatable {
    let entryId: String
    let blob: String
    let dim: Int
    let model: String

    init(entryId: String, blob: String, dim: Int, model: String) {
        self.entryId = entryId
        self.blob = blob
        self.dim = dim
        self.model = model
    }
}

/// Abstraction over the server's encrypted-vector sync surface, so the
/// `SemanticIndexCoordinator` (and 19b wiring / tests) can inject a fake with no
/// network. The three operations map 1:1 to the already-built endpoints:
///   - `upsert`  → `POST /v1/vectors/batch`   (works for one or many rows)
///   - `list`    → `GET  /v1/vectors`
///   - `delete`  → `DELETE /v1/vectors/:entryId`
///
/// There is deliberately no `PUT` (the `ProxyAPIClient` has none); upserts go
/// through the batch POST.
protocol VectorSyncService {
    /// Insert-or-replace `items` server-side. A no-op for an empty batch.
    func upsert(_ items: [VectorSyncItem]) async throws
    /// Every stored vector row for the authenticated user.
    func list() async throws -> [VectorSyncItem]
    /// Remove the row for `entryId` (idempotent server-side).
    func delete(entryId: String) async throws
}

/// The concrete `VectorSyncService` over `ProxyAPIClient`, following the same
/// base-path + Codable-DTO pattern as `ProxyAIService` / `ProxySoulService`.
final class ProxyVectorService: VectorSyncService {

    private let api: ProxyAPIClient

    init(api: ProxyAPIClient) {
        self.api = api
    }

    // MARK: - DTOs

    /// `POST /v1/vectors/batch` body: `{ vectors: [{entryId, blob, dim, model}] }`.
    private struct BatchBody: Encodable {
        let vectors: [Row]
        struct Row: Encodable {
            let entryId: String
            let blob: String
            let dim: Int
            let model: String
        }
    }

    /// `GET /v1/vectors` response: `{ vectors: [{entryId, blob, dim, model, updatedAt}] }`.
    /// `updatedAt` is intentionally omitted — unknown JSON keys are ignored, so we
    /// avoid coupling to the server's timestamp encoding.
    private struct ListResponse: Decodable {
        let vectors: [Row]
        struct Row: Decodable {
            let entryId: String
            let blob: String
            let dim: Int
            let model: String
        }
    }

    // MARK: - VectorSyncService

    func upsert(_ items: [VectorSyncItem]) async throws {
        guard !items.isEmpty else { return }
        let body = BatchBody(
            vectors: items.map {
                BatchBody.Row(entryId: $0.entryId, blob: $0.blob, dim: $0.dim, model: $0.model)
            }
        )
        try await api.post(path: "/v1/vectors/batch", body: body)
    }

    func list() async throws -> [VectorSyncItem] {
        let response: ListResponse = try await api.get(path: "/v1/vectors")
        return response.vectors.map {
            VectorSyncItem(entryId: $0.entryId, blob: $0.blob, dim: $0.dim, model: $0.model)
        }
    }

    func delete(entryId: String) async throws {
        let encoded = entryId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? entryId
        try await api.delete(path: "/v1/vectors/\(encoded)")
    }
}

/// The concrete string encoding of a sealed vector's `blob` field.
///
/// **Encoding:** `blob = base64( UTF8( JSON( WrappedKey.firestoreData ) ) )` — i.e.
/// the existing `{v, iv, ct, tag}` envelope (with `iv`/`ct`/`tag` as base64
/// strings) serialized to JSON, then base64-encoded so it is a single ASCII-safe
/// token on the wire. Decoding reverses that and reuses `WrappedKey(data:)`, which
/// re-validates the envelope (v1, 12-byte nonce, 16-byte tag), so a malformed or
/// truncated blob decodes to `nil` (fail-closed) rather than a bogus wrap.
enum VectorBlobCodec {

    /// Encode a sealed envelope into the wire `blob` string.
    static func encode(_ wrapped: WrappedKey) -> String {
        // `firestoreData` is a `[String: Any]` of JSON-safe scalars/base64 strings,
        // so serialization cannot fail for a well-formed WrappedKey.
        let json = (try? JSONSerialization.data(withJSONObject: wrapped.firestoreData)) ?? Data()
        return json.base64EncodedString()
    }

    /// Decode a wire `blob` string back into a `WrappedKey`. Returns `nil` for any
    /// malformed input (bad base64, non-JSON, or a non-v1 / wrong-shape envelope).
    static func decode(_ blob: String) -> WrappedKey? {
        guard
            let json = Data(base64Encoded: blob),
            let object = try? JSONSerialization.jsonObject(with: json)
        else { return nil }
        return WrappedKey(data: object)
    }
}
