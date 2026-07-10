import Foundation

/// Narrow network surface the zero-knowledge key-migration flow needs, so a
/// later `KeyMigrator` can be unit-tested without real HTTP. Backed by
/// `ProxyAPIClient` in production via `ProxyKeyMigrationTransport`.
protocol KeyMigrationTransport {
    /// Upload both wraps of the DEK (`PUT /v1/keys/wrapped`).
    func uploadWraps(_ wraps: MultiWrappedDEK) async throws
    /// Fetch the current wraps (`GET /v1/keys/wrapped`). Returns nil if either
    /// wrap is missing or malformed.
    func fetchWraps() async throws -> MultiWrappedDEK?
    /// Mark the migration complete server-side (`POST /v1/keys/finalize-migration`).
    func finalizeMigration() async throws
}

/// `KeyMigrationTransport` backed by `ProxyAPIClient`. Maps `MultiWrappedDEK`
/// to/from the server's base64-JSON envelope shape `{ v, iv, ct, tag }`
/// (see `server/src/crypto/keyService.ts`), keeping the wire format symmetric
/// with `WrappedKey.firestoreData` / `WrappedKey(data:)`.
final class ProxyKeyMigrationTransport: KeyMigrationTransport {

    private let api: ProxyAPIClient

    init(api: ProxyAPIClient) {
        self.api = api
    }

    /// Base64-JSON wire shape for a single `WrappedKey`.
    private struct EnvelopeDTO: Codable {
        let v: Int
        let iv: String
        let ct: String
        let tag: String
    }

    private struct PutBody: Encodable {
        let wraps: [String: EnvelopeDTO]
        let keyVersion: Int
    }

    private struct WrappedKeysResponse: Decodable {
        struct Wraps: Decodable {
            let icloud: EnvelopeDTO?
            let recovery: EnvelopeDTO?
        }
        let wrappedKeys: Wraps?
    }

    private struct EmptyBody: Encodable {}

    func uploadWraps(_ wraps: MultiWrappedDEK) async throws {
        let body = PutBody(
            wraps: [
                "icloud": Self.envelope(from: wraps.icloud),
                "recovery": Self.envelope(from: wraps.recovery),
            ],
            keyVersion: WrappedKey.version
        )
        try await api.put(path: "/v1/keys/wrapped", body: body)
    }

    func fetchWraps() async throws -> MultiWrappedDEK? {
        let response: WrappedKeysResponse = try await api.get(path: "/v1/keys/wrapped")
        guard
            let wraps = response.wrappedKeys,
            let icloudDTO = wraps.icloud,
            let recoveryDTO = wraps.recovery,
            let icloud = Self.wrappedKey(from: icloudDTO),
            let recovery = Self.wrappedKey(from: recoveryDTO)
        else { return nil }
        return MultiWrappedDEK(icloud: icloud, recovery: recovery)
    }

    func finalizeMigration() async throws {
        try await api.post(path: "/v1/keys/finalize-migration", body: EmptyBody())
    }

    // MARK: - DTO mapping

    private static func envelope(from key: WrappedKey) -> EnvelopeDTO {
        EnvelopeDTO(
            v: key.v,
            iv: key.iv.base64EncodedString(),
            ct: key.ct.base64EncodedString(),
            tag: key.tag.base64EncodedString()
        )
    }

    /// Base64-decode an `EnvelopeDTO` back into a `WrappedKey`. Returns nil
    /// for a malformed envelope (fail closed rather than crash/garbage-key).
    private static func wrappedKey(from dto: EnvelopeDTO) -> WrappedKey? {
        guard
            let iv = Data(base64Encoded: dto.iv),
            let ct = Data(base64Encoded: dto.ct),
            let tag = Data(base64Encoded: dto.tag)
        else { return nil }
        return WrappedKey(iv: iv, ct: ct, tag: tag, v: dto.v)
    }
}
