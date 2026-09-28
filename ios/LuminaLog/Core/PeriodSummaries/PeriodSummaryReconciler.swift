import Foundation
import OSLog

/// Keeps `periodSummaries` caught up. Client-driven because the server is
/// zero-knowledge (ADR-0073): it holds no key, so a server cron could not read the
/// entries. Every run is idempotent: read all entries and stored summaries, delete
/// orphans, then ask `PeriodSummaryPlanner` for the next ready period, generate it,
/// save it, and repeat until the budget or the work runs out. Unfinished work waits
/// for the next run, which is how the backfill of existing history paces itself.
@MainActor
final class PeriodSummaryReconciler {

    struct RunResult: Equatable {
        enum Skip: Equatable { case disabled, noConsent, throttled, notEntitled }
        var generated = 0
        var failed = 0
        var deleted = 0
        var aborted = false
        var skipped: Skip?
    }

    static let throttleInterval: TimeInterval = 10 * 60
    static let notEntitledBackoff: TimeInterval = 6 * 60 * 60
    static let maxConsecutiveFailures = 3
    static let voiceRefreshBudget = 6

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "period-summaries")

    private let generator: PeriodSummaryGenerating
    private let repository: PeriodSummaryRepository
    private let loadEntries: @MainActor () async throws -> [JournalEntry]
    private let timeZone: @MainActor () async -> TimeZone
    private let hasConsent: @MainActor () -> Bool
    private let isEnabled: @MainActor () -> Bool
    private let now: @MainActor () -> Date

    private var inFlight: Task<RunResult, Never>?
    private var lastClosedRunAt: Date?
    private var notEntitledUntil: Date?
    /// The refresh started by `voiceMemoryContext()`, kept so tests can await it.
    private(set) var backgroundRefresh: Task<RunResult, Never>?

    init(
        generator: PeriodSummaryGenerating,
        repository: PeriodSummaryRepository,
        loadEntries: @escaping @MainActor () async throws -> [JournalEntry],
        timeZone: @escaping @MainActor () async -> TimeZone,
        hasConsent: @escaping @MainActor () -> Bool,
        isEnabled: @escaping @MainActor () -> Bool = { DevFlags.periodSummaries },
        now: @escaping @MainActor () -> Date = Date.init
    ) {
        self.generator = generator
        self.repository = repository
        self.loadEntries = loadEntries
        self.timeZone = timeZone
        self.hasConsent = hasConsent
        self.isEnabled = isEnabled
        self.now = now
    }

    /// One catch-up pass. A call made while a pass is running joins it and returns
    /// its result instead of starting a second pass (so a voice call's open-period
    /// refresh that lands during a foreground pass just waits for that pass).
    @discardableResult
    func run(budget: Int, includeOpen: Bool) async -> RunResult {
        if let inFlight { return await inFlight.value }
        let task = Task { await self.perform(budget: budget, includeOpen: includeOpen) }
        inFlight = task
        let result = await task.value
        inFlight = nil
        return result
    }

    private func perform(budget: Int, includeOpen: Bool) async -> RunResult {
        var result = RunResult()
        guard isEnabled() else { result.skipped = .disabled; return result }
        guard hasConsent() else { result.skipped = .noConsent; return result }
        let startedAt = now()
        if let until = notEntitledUntil, startedAt < until { result.skipped = .notEntitled; return result }
        if !includeOpen {
            if let last = lastClosedRunAt, startedAt.timeIntervalSince(last) < Self.throttleInterval {
                result.skipped = .throttled; return result
            }
            lastClosedRunAt = startedAt
        }

        let tz = await timeZone()
        let today = PeriodSummaryIndex.localDayIndex(for: startedAt, in: tz)
        let entries: [JournalEntry]
        var existing: [PeriodKey: PeriodSummary]
        do {
            entries = try await loadEntries()
            existing = Dictionary(try await repository.all().map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        } catch {
            Self.logger.error("period summaries: load failed: \(error.localizedDescription, privacy: .public)")
            result.aborted = true
            return result
        }

        // A loader that comes back empty without throwing (cold cache, offline) would
        // otherwise make every stored summary look orphaned and delete it, only for it
        // to be regenerated (at AI cost) once entries reload. Treat that as "nothing to
        // do this run" instead of trusting an empty read against existing data.
        guard !(entries.isEmpty && !existing.isEmpty) else { return result }

        let tree = PeriodSummaryPlanner.tree(entries: entries, timeZone: tz)
        for key in PeriodSummaryPlanner.orphans(tree: tree, existing: existing) {
            do {
                try await repository.delete(key)
                existing[key] = nil
                result.deleted += 1
            } catch {
                Self.logger.error("period summaries: orphan delete failed \(key.docId, privacy: .public)")
            }
        }

        var remaining = budget
        var consecutiveFailures = 0
        var failedKeys: Set<PeriodKey> = []
        while remaining > 0,
              let item = PeriodSummaryPlanner.next(tree: tree, existing: existing, today: today, timeZone: tz,
                                                   includeOpen: includeOpen, excluding: failedKeys) {
            remaining -= 1
            do {
                let generated = try await generator.generatePeriodSummary(item.request)
                let summary = PeriodSummary(
                    key: item.key,
                    title: generated.title,
                    sentence: generated.sentence,
                    summary: generated.summary,
                    generatedAt: Self.wholeMillis(now()),
                    sourceCount: item.children.count,
                    sourceFingerprint: item.fingerprint,
                    isOpen: item.isOpen,
                    model: generated.model,
                    promptVersion: PeriodSummaryPlanner.promptVersion,
                    details: generated.details
                )
                try await repository.save(summary)
                existing[item.key] = summary
                result.generated += 1
                consecutiveFailures = 0
            } catch let ProxyAPIError.httpError(statusCode, _) where statusCode == 402 || statusCode == 403 {
                notEntitledUntil = now().addingTimeInterval(Self.notEntitledBackoff)
                result.aborted = true
                break
            } catch {
                Self.logger.error("period summaries: \(item.key.docId, privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
                result.failed += 1
                consecutiveFailures += 1
                failedKeys.insert(item.key)
                if consecutiveFailures >= Self.maxConsecutiveFailures {
                    result.aborted = true
                    break
                }
            }
        }
        Self.logger.info("period summaries: generated \(result.generated) failed \(result.failed) deleted \(result.deleted)")
        return result
    }

    /// Truncates to whole milliseconds so a Firestore Timestamp round trip gives
    /// back the same millisecond, keeping parent fingerprints stable across runs.
    private static func wholeMillis(_ date: Date) -> Date {
        Date(timeIntervalSince1970: (date.timeIntervalSince1970 * 1_000).rounded(.down) / 1_000)
    }
}
