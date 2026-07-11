import Foundation

/// Abstraction over the proxy client's PUT so `ConsentService` is testable.
/// `ProxyAPIClient` already satisfies this signature.
protocol ConsentAPIPutting {
    func put(path: String, body: some Encodable) async throws
}

/// Mirrors the local AI-data-sharing consent to the server
/// (`PUT /v1/consent`), which the server's `requireAiConsent` guard reads.
final class ConsentService {
    private struct Body: Encodable { let aiDataSharing = true; let version = ConsentStore.version }

    private let api: ConsentAPIPutting
    private let store: ConsentStore

    init(api: ConsentAPIPutting, store: ConsentStore) {
        self.api = api
        self.store = store
    }

    /// Writes consent to the server and marks the store synced. Throws on failure
    /// (leaving `needsServerSync` true so a later attempt retries).
    func sync() async throws {
        try await api.put(path: "/v1/consent", body: Body())
        store.markSynced()
    }

    /// Best-effort: sync only if there is unsynced local consent. Never throws.
    func syncIfNeeded() async {
        guard store.needsServerSync else { return }
        try? await sync()
    }
}

extension ProxyAPIClient: ConsentAPIPutting {}
