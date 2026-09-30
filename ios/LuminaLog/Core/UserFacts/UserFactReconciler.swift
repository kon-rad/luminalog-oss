import Foundation
import OSLog

/// Keeps "What Argo knows" caught up with the journal. Client-driven because the server
/// is zero-knowledge (ADR-0073). Each run: load, prune evidence of deleted entries, then
/// ask `UserFactPlanner` for the next chronological batch, send it, apply the ops with
/// `UserFactMerger` to a FRESH read of the facts, save, repeat until the budget or the
/// backlog runs out. Unfinished work waits for the next run, which paces the backfill.
@MainActor
final class UserFactReconciler {

    struct RunResult: Equatable {
        enum Skip: Equatable { case disabled, noConsent, paused, throttled, notEntitled }
        var batches = 0
        var failed = 0
        var added = 0
        var pruned = 0
        var aborted = false
        var skipped: Skip?
    }

    static let throttleInterval: TimeInterval = 30 * 60
    static let notEntitledBackoff: TimeInterval = 6 * 60 * 60
    static let maxConsecutiveFailures = 2
    static let foregroundBudget = 4
    static let screenBudget = 2

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "user-facts")

    private let extractor: UserFactExtracting
    private let repository: UserFactRepository
    /// All entries, plus whether the read was confirmed by the server (not the offline
    /// cache, no undecodable docs dropped). Pruning trusts only a server-confirmed list;
    /// extraction runs regardless, since a cache read still yields real content.
    private let loadEntries: @MainActor () async throws -> (entries: [JournalEntry], isFromServer: Bool)
    private let hasConsent: @MainActor () -> Bool
    private let isEnabled: @MainActor () -> Bool
    private let timeZone: @MainActor () -> TimeZone
    private let now: @MainActor () -> Date
    private let makeId: () -> String

    private var inFlight: Task<RunResult, Never>?
    private var lastRunAt: Date?
    private var notEntitledUntil: Date?
    /// Bumped by `pause()`. A run records it at the start and stops before any write
    /// once it has changed, so a same-process "Forget everything" or pause that lands
    /// between the run's re-read and its saves is never undone.
    private var pauseEpoch = 0

    init(
        extractor: UserFactExtracting,
        repository: UserFactRepository,
        loadEntries: @escaping @MainActor () async throws -> (entries: [JournalEntry], isFromServer: Bool),
        hasConsent: @escaping @MainActor () -> Bool,
        isEnabled: @escaping @MainActor () -> Bool = { DevFlags.userFacts },
        timeZone: @escaping @MainActor () -> TimeZone = { .current },
        now: @escaping @MainActor () -> Date = Date.init,
        makeId: @escaping () -> String = { UUID().uuidString }
    ) {
        self.extractor = extractor
        self.repository = repository
        self.loadEntries = loadEntries
        self.hasConsent = hasConsent
        self.isEnabled = isEnabled
        self.timeZone = timeZone
        self.now = now
        self.makeId = makeId
    }

    /// Called by the facts screen when learning is turned off or everything is forgotten,
    /// before it writes. A run in flight stops without writing anything more.
    func pause() {
        pauseEpoch += 1
    }

    /// One pass. A call made during a pass joins it instead of starting another.
    /// `force` skips the 30-minute throttle (the facts screen opening, pull to refresh).
    @discardableResult
    func run(budget: Int, force: Bool = false) async -> RunResult {
        if let inFlight { return await inFlight.value }
        let task = Task { await self.perform(budget: budget, force: force) }
        inFlight = task
        let result = await task.value
        inFlight = nil
        return result
    }

    private func perform(budget: Int, force: Bool) async -> RunResult {
        var result = RunResult()
        guard isEnabled() else { result.skipped = .disabled; return result }
        guard hasConsent() else { result.skipped = .noConsent; return result }
        let startedAt = now()
        if let until = notEntitledUntil, startedAt < until { result.skipped = .notEntitled; return result }
        if !force, let last = lastRunAt, startedAt.timeIntervalSince(last) < Self.throttleInterval {
            result.skipped = .throttled; return result
        }
        lastRunAt = startedAt
        let epoch = pauseEpoch
        var isPaused: Bool { pauseEpoch != epoch }

        let entries: [JournalEntry]
        let isFromServer: Bool
        // The FULL fresh list, tombstones (`.rejected`) and invalidated facts included:
        // the merger's tombstone guard must see a deleted fact to keep it dead.
        var facts: [UserFact]
        var state: UserFactExtractionState
        do {
            (entries, isFromServer) = try await loadEntries()
            facts = try await repository.all()
            state = try await repository.state()
        } catch {
            Self.logger.error("user facts: load failed: \(error.localizedDescription, privacy: .public)")
            result.aborted = true
            return result
        }
        guard state.learning, !isPaused else { result.skipped = .paused; return result }

        // Prune only against a server-confirmed, complete list. A cache read
        // (isFromServer == false) may be missing entries that still exist, and an
        // empty list (the key not loaded yet) would otherwise delete every fact.
        // Extraction below is unaffected: it only reads what `loadEntries()` gave it.
        if isFromServer, !entries.isEmpty {
            do {
                result.pruned = try await prune(facts: &facts, state: &state,
                                                liveIds: Set(entries.map(\.id)), at: startedAt,
                                                isPaused: { isPaused })
            } catch {
                Self.logger.error("user facts: prune failed: \(error.localizedDescription, privacy: .public)")
            }
        }

        let tz = timeZone()
        var remaining = budget
        var consecutiveFailures = 0
        batches: while remaining > 0,
              let batch = UserFactPlanner.nextBatch(entries: entries, facts: facts, state: state, now: now(), timeZone: tz) {
            guard !isPaused else { result.skipped = .paused; break batches }
            remaining -= 1
            // Only the model call can charge the entries a failure. A storage error
            // after it (below) is not the entries' fault, so it never counts toward
            // skipping them.
            let response: UserFactsResponse
            do {
                response = try await extractor.extractUserFacts(batch.request)
            } catch {
                if Self.isNotEntitled(error) {
                    notEntitledUntil = now().addingTimeInterval(Self.notEntitledBackoff)
                    result.aborted = true
                    break batches
                }
                Self.logger.error("user facts: batch failed: \(error.localizedDescription, privacy: .public)")
                result.failed += 1
                consecutiveFailures += 1
                // Fresh state, so a concurrent "Forget everything" is not overwritten.
                var latest = (try? await repository.state()) ?? state
                guard latest.learning, !isPaused else { result.skipped = .paused; break batches }
                for id in batch.entryIds {
                    let count = (latest.failures[id] ?? 0) + 1
                    latest.failures[id] = count
                    if count >= UserFactPlanner.skipAfterFailures, let stamp = batch.stamps[id] {
                        latest.skipped[id] = stamp
                    }
                }
                try? await repository.saveExtractionProgress(latest)
                state = latest
                if consecutiveFailures >= Self.maxConsecutiveFailures {
                    result.aborted = true
                    break batches
                }
                continue batches
            }
            do {
                // Re-read both, full and fresh: an edit, a delete or "Forget everything"
                // made while the request was in flight must win over this run's copies.
                let fresh = try await repository.all()
                state = try await repository.state()
                // The merge below is synchronous, so this is the last check before the
                // first write; `isPaused` is re-checked before every later one.
                guard state.learning, !isPaused else { result.skipped = .paused; break batches }
                let outcome = UserFactMerger.apply(response.ops, to: fresh, batch: batch, model: response.model,
                                                   now: Self.wholeMillis(now()), makeId: makeId)
                for fact in outcome.upserts {
                    guard !isPaused else { result.skipped = .paused; break batches }
                    try await repository.save(fact)
                }
                guard !isPaused else { result.skipped = .paused; break batches }
                for (id, stamp) in batch.stamps {
                    state.processed[id] = stamp
                    state.failures[id] = nil
                }
                state.promptVersion = UserFactPlanner.promptVersion
                try await repository.saveExtractionProgress(state)
                facts = Self.replacing(fresh, with: outcome.upserts)
                result.batches += 1
                result.added += outcome.added
                consecutiveFailures = 0
            } catch {
                Self.logger.error("user facts: save failed: \(error.localizedDescription, privacy: .public)")
                result.aborted = true
                break batches
            }
        }
        Self.logger.info("user facts: batches \(result.batches) failed \(result.failed) added \(result.added) pruned \(result.pruned)")
        return result
    }

    private func prune(
        facts: inout [UserFact], state: inout UserFactExtractionState, liveIds: Set<String>, at date: Date,
        isPaused: () -> Bool
    ) async throws -> Int {
        let (updated, deletedIds) = UserFactMerger.pruneDeletedEntries(facts, liveEntryIds: liveIds, now: date)
        for id in deletedIds {
            guard !isPaused() else { return 0 }
            try await repository.delete(id: id)
        }
        for fact in updated {
            guard !isPaused() else { return 0 }
            try await repository.save(fact)
        }
        facts = Self.replacing(facts.filter { !deletedIds.contains($0.id) }, with: updated)
        var next = state
        next.processed = next.processed.filter { liveIds.contains($0.key) }
        next.failures = next.failures.filter { liveIds.contains($0.key) }
        next.skipped = next.skipped.filter { liveIds.contains($0.key) }
        if next != state, !isPaused() {
            try await repository.saveExtractionProgress(next)
            state = next
        }
        return updated.count + deletedIds.count
    }

    private static func isNotEntitled(_ error: Error) -> Bool {
        guard case .httpError(let status, _)? = error as? ProxyAPIError else { return false }
        return status == 402 || status == 403
    }

    private static func replacing(_ facts: [UserFact], with changed: [UserFact]) -> [UserFact] {
        var byId = Dictionary(facts.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var order = facts.map(\.id)
        for fact in changed {
            if byId[fact.id] == nil { order.append(fact.id) }
            byId[fact.id] = fact
        }
        return order.compactMap { byId[$0] }
    }

    /// Whole milliseconds, so a Firestore Timestamp round trip gives the same value back.
    private static func wholeMillis(_ date: Date) -> Date {
        Date(timeIntervalSince1970: (date.timeIntervalSince1970 * 1_000).rounded(.down) / 1_000)
    }
}
