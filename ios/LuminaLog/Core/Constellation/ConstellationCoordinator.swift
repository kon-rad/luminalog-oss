import Foundation

/// Rebuilds the entire anchored constellation from the local corpus, then uploads
/// coordinates only. Gated by `DevFlags.aiModel1`. `@MainActor` so the coalescing
/// flags are race-free; the heavy work (embedding lookups / projection / upload) is
/// async and hops off the main actor at each `await`.
@MainActor
final class ConstellationCoordinator {
    private let builder: ConstellationBuilder
    private let sync: ConstellationSyncing
    private let entriesProvider: () async throws -> [(id: String, text: String, wordCount: Int, createdAt: Date)]

    private var isRunning = false
    private var rerunRequested = false

    init(builder: ConstellationBuilder,
         sync: ConstellationSyncing,
         entriesProvider: @escaping () async throws -> [(id: String, text: String, wordCount: Int, createdAt: Date)]) {
        self.builder = builder
        self.sync = sync
        self.entriesProvider = entriesProvider
    }

    /// Fire-and-forget, coalesced: guarantees a rebuild reflecting the latest corpus
    /// runs after this call, without stacking concurrent rebuilds. Safe to call on
    /// every entry save — overlapping calls collapse into one in-flight run plus at
    /// most one queued re-run.
    func scheduleRebuild() {
        guard DevFlags.aiModel1 else { return }
        if isRunning { rerunRequested = true; return }
        isRunning = true
        Task { [weak self] in
            guard let self else { return }
            repeat {
                self.rerunRequested = false
                do { _ = try await self.rebuildAndSync() }
                catch { print("[ConstellationCoordinator] scheduled rebuild failed: \(error)") }
            } while self.rerunRequested
            self.isRunning = false
        }
    }

    /// Returns the number of stars uploaded (0 when the flag is off or the corpus
    /// is empty).
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
