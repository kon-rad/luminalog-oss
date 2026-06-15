import Foundation

/// Production `KeyProvider`: fetches the raw DEK from the proxy.
/// The proxy unwraps the user's stored wrapped DEK and returns it over TLS
/// (spec §3.3). Contract: `POST /v1/keys/bootstrap` → `{ "dek": "<base64>" }`.
final class ProxyKeyProvider: KeyProvider {

    private let api: ProxyAPIClient

    init(api: ProxyAPIClient) {
        self.api = api
    }

    private struct BootstrapRequest: Encodable {}
    private struct BootstrapResponse: Decodable { let dek: String }

    func fetchDataKey(userId: String) async throws -> Data {
        let response: BootstrapResponse = try await api.post(
            path: "/v1/keys/bootstrap",
            body: BootstrapRequest()
        )
        guard let data = Data(base64Encoded: response.dek) else {
            throw UserKeyStoreError.invalidKeyLength
        }
        return data
    }
}
