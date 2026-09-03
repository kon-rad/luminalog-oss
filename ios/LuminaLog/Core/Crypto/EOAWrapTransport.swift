import Foundation

/// Uploads/fetches ONLY the `eoa` wrap slot (spec clause 6.1), independent of
/// `KeyMigrationTransport`'s icloud+recovery pair. The server's `PUT
/// /v1/keys/wrapped` merges the wraps map (`server/src/routes/keys.ts`), so
/// this never touches the other two slots.
protocol EOAWrapTransport {
    /// `PUT /v1/keys/wrapped` with `{wraps: {eoa: envelope}}`.
    func uploadEOAWrap(_ wrap: WrappedKey) async throws
    /// `GET /v1/keys/wrapped`, returning only the `eoa` slot (nil if absent
    /// or malformed — fail closed rather than hand back a garbage wrap).
    func fetchEOAWrap() async throws -> WrappedKey?
}

final class ProxyEOAWrapTransport: EOAWrapTransport {

    private let api: ProxyAPIClient

    init(api: ProxyAPIClient) {
        self.api = api
    }

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
            let eoa: EnvelopeDTO?
        }
        let wrappedKeys: Wraps?
    }

    func uploadEOAWrap(_ wrap: WrappedKey) async throws {
        let body = PutBody(
            wraps: ["eoa": Self.envelope(from: wrap)],
            keyVersion: WrappedKey.version
        )
        try await api.put(path: "/v1/keys/wrapped", body: body)
    }

    func fetchEOAWrap() async throws -> WrappedKey? {
        let response: WrappedKeysResponse = try await api.get(path: "/v1/keys/wrapped")
        guard let dto = response.wrappedKeys?.eoa else { return nil }
        return Self.wrappedKey(from: dto)
    }

    private static func envelope(from key: WrappedKey) -> EnvelopeDTO {
        EnvelopeDTO(
            v: key.v,
            iv: key.iv.base64EncodedString(),
            ct: key.ct.base64EncodedString(),
            tag: key.tag.base64EncodedString()
        )
    }

    private static func wrappedKey(from dto: EnvelopeDTO) -> WrappedKey? {
        guard
            let iv = Data(base64Encoded: dto.iv),
            let ct = Data(base64Encoded: dto.ct),
            let tag = Data(base64Encoded: dto.tag)
        else { return nil }
        return WrappedKey(iv: iv, ct: ct, tag: tag, v: dto.v)
    }
}
