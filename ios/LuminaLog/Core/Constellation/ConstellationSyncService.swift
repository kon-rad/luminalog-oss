import Foundation

struct ConstellationUploadBody: Encodable {
    let points: [ConstellationPoint]
}

protocol ConstellationSyncing {
    /// Overwrites the server point-set with the given coordinates (server bumps version).
    func upload(points: [ConstellationPoint]) async throws
}

/// Uploads coordinates only to the blind server sink. No embeddings ever leave the device.
final class ProxyConstellationSyncService: ConstellationSyncing {
    private let api: ProxyAPIClient
    init(api: ProxyAPIClient) { self.api = api }

    func upload(points: [ConstellationPoint]) async throws {
        try await api.put(path: "/v1/soul/constellation", body: ConstellationUploadBody(points: points))
    }
}
