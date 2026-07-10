import Foundation

/// One-shot rebuild of the entire constellation from the local corpus, then upload.
/// Gated by `DevFlags.aiModel1` so production (flag off) is unaffected until the ZK cutover.
final class ConstellationCoordinator {
    private let builder: ConstellationBuilder
    private let sync: ConstellationSyncing
    private let entriesProvider: () async throws -> [(text: String, wordCount: Int, createdAt: Date)]

    init(builder: ConstellationBuilder,
         sync: ConstellationSyncing,
         entriesProvider: @escaping () async throws -> [(text: String, wordCount: Int, createdAt: Date)]) {
        self.builder = builder
        self.sync = sync
        self.entriesProvider = entriesProvider
    }

    /// Returns the number of stars uploaded (0 when the flag is off).
    @discardableResult
    func rebuildAndSync() async throws -> Int {
        guard DevFlags.aiModel1 else { return 0 }
        let entries = try await entriesProvider()
        // A transient empty corpus fetch must not overwrite the server's existing
        // point-set with an empty set — bail out before uploading anything.
        guard !entries.isEmpty else { return 0 }
        let points = try await builder.build(entries: entries)
        try await sync.upload(points: points)
        return points.count
    }
}
