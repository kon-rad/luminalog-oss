import Foundation
import OSLog

/// Generates an entry's derived AI (summary + insights + prompts) HEADLESSLY — with
/// no detail view open — so a saved journal gets its AI right after it settles and,
/// as a launch-time safety net, on the next app open. Before this, the AI was only
/// ever produced lazily when the user opened that specific entry's detail screen, so
/// a voice memo you never opened stayed "pending" forever.
///
/// Zero-knowledge: generation runs ON DEVICE via `AIService.generateEntryAI`, which
/// reads the decrypted entry locally and posts only its plaintext to the stateless
/// `/entry-ai` endpoint; the result is written back client-encrypted via
/// `updateAIFields`. There is no server-side job (the server holds no key).
///
/// The three callers — the finalize pipeline (`EntryFinalizer`, at save), the launch
/// sweep (`LuminaLogApp`), and any repeat — all funnel through `ensureAI(for:)`, which
/// is idempotent, de-duped, and best-effort.
@MainActor
final class EntryAIGenerator {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "entry-ai-gen")

    private let journals: JournalRepository
    private let ai: AIService
    private let backgroundActivity: BackgroundActivityGranting

    /// Entries with a generation currently in flight, so the pipeline + sweep (or a
    /// repeated ensure) can't fire a second `/entry-ai` call for the same entry.
    /// Claimed synchronously before the first `await`, so concurrent `ensureAI` calls
    /// on the `@MainActor` serial executor see the claim.
    private var inFlight: Set<String> = []

    /// Per-entry attempt counter for THIS session, so a genuinely un-generatable
    /// entry (e.g. every fallback slug down) can't hot-loop the sweep within one
    /// launch. It resets across launches: the sweep re-attempts on the next launch,
    /// so an entry that failed during a transient outage self-heals once the provider
    /// recovers. Cancellations do not count (they aren't real failures).
    private var attempts: [String: Int] = [:]
    private static let maxSessionAttempts = 3

    init(
        journals: JournalRepository,
        ai: AIService,
        backgroundActivity: BackgroundActivityGranting? = nil
    ) {
        self.journals = journals
        self.ai = ai
        // Construct the default INSIDE this @MainActor init (not as a default argument):
        // `ImmediateBackgroundActivity` conforms to the @MainActor `BackgroundActivityGranting`,
        // so evaluating its initializer in a nonisolated default-argument context is illegal
        // (same pattern JournalDetailViewModel uses for its media/profiles fallbacks).
        self.backgroundActivity = backgroundActivity ?? ImmediateBackgroundActivity()
    }

    /// Ensure `entryID` has summary + insights + prompts, generating them if missing.
    /// Idempotent, de-duped, and best-effort. Returns true only when this call
    /// generated + persisted the AI; false when it skipped (flag off, deduped, no
    /// longer needs AI, empty content, attempt cap) or the generation failed.
    @discardableResult
    func ensureAI(for entryID: String) async -> Bool {
        // The ZK path is the only generation path; mirror the guard used by the
        // detail view and the transcript backfiller.
        guard DevFlags.aiModel1 else { return false }
        // Claim the entry BEFORE any await so a concurrent ensure (serialized on the
        // main actor) observes the in-flight set and bails instead of double-firing.
        guard !inFlight.contains(entryID) else { return false }
        guard (attempts[entryID] ?? 0) < Self.maxSessionAttempts else { return false }
        inFlight.insert(entryID)
        defer { inFlight.remove(entryID) }

        guard
            let entry = await firstEmission(journals.entry(id: entryID)).flatMap({ $0 }),
            !entry.content.isEmpty,
            Self.needsAI(entry)
        else { return false }

        do {
            // Keep the app alive across a brief backgrounding so the in-flight request
            // isn't suspended → aborted (the historical entry-AI 499s). Anything the
            // ~30s assertion can't cover is caught by the next launch sweep.
            try await backgroundActivity.run("entry-ai-generation") {
                let bundle = try await self.ai.generateEntryAI(journalId: entryID)
                try await self.journals.updateAIFields(
                    id: entryID,
                    summary: bundle.summary,
                    insights: bundle.insights,
                    prompts: bundle.prompts
                )
            }
            return true
        } catch {
            if Self.isCancellation(error) {
                // The work was torn down (e.g. app suspended past the assertion) — not a
                // real failure. Don't spend an attempt; the sweep retries next launch.
                Self.logger.notice("ensureAI cancelled for \(entryID, privacy: .public); will retry")
                return false
            }
            attempts[entryID, default: 0] += 1
            Self.logger.error("ensureAI failed for \(entryID, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    /// Launch-time safety net: ensure every entry that has content but is still
    /// missing its AI. Best-effort and idempotent — an entry that can't be generated
    /// is simply retried on the next launch (bounded by `maxSessionAttempts` per
    /// session). Runs AFTER the transcript backfill, so it only mops up whatever that
    /// (and the at-save pipeline) didn't already produce.
    func sweep() async {
        guard DevFlags.aiModel1 else { return }
        let entries = (try? await journals.fetchAllEntries()) ?? []
        let needing = entries.filter { !$0.content.isEmpty && Self.needsAI($0) }
        guard !needing.isEmpty else { return }
        Self.logger.notice("AI sweep: \(needing.count, privacy: .public) entr(ies) need AI")
        for entry in needing {
            await ensureAI(for: entry.id)
        }
    }

    // MARK: - Cognitive map

    /// How many un-mapped entries the launch sweep will backfill per launch.
    ///
    /// A blanket sweep over a large corpus would fire three model calls per entry on
    /// first launch, which is unkind to both the battery and the bill. Older entries
    /// map on demand instead, the first time their Map tab is opened.
    static let mapBackfillLimit = 10

    /// Ensure `entryID` has a cognitive map, generating one if it is missing or stale.
    /// Idempotent, de-duped, and best-effort. Returns true only when this call
    /// generated AND persisted a map.
    @discardableResult
    func ensureMap(for entryID: String) async -> Bool {
        guard DevFlags.aiModel1 else { return false }
        // Namespaced so a map generation and an entry-AI generation for the same entry
        // never block each other. Claimed BEFORE any await so a concurrent ensure
        // (serialized on the main actor) observes it and bails instead of double-firing.
        let key = Self.mapKey(entryID)
        guard !inFlight.contains(key) else { return false }
        guard (attempts[key] ?? 0) < Self.maxSessionAttempts else { return false }
        inFlight.insert(key)
        defer { inFlight.remove(key) }

        guard
            let entry = await firstEmission(journals.entry(id: entryID)).flatMap({ $0 }),
            entry.needsCognitiveMap
        else { return false }

        do {
            // Keep the app alive across a brief backgrounding so the in-flight request
            // isn't suspended into a 499. Anything the assertion can't cover is caught
            // by the next launch sweep.
            try await backgroundActivity.run("entry-map-generation") {
                let map = try await self.ai.generateEntryMap(journalId: entryID)
                try await self.journals.updateCognitiveMap(id: entryID, map: map)
            }
            return true
        } catch {
            if Self.isCancellation(error) {
                // Torn down, not failed. Don't spend an attempt.
                Self.logger.notice("ensureMap cancelled for \(entryID, privacy: .public); will retry")
                return false
            }
            attempts[key, default: 0] += 1
            Self.logger.error("ensureMap failed for \(entryID, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    /// Launch-time backfill: map the most recent entries that still lack one, capped at
    /// `mapBackfillLimit`. Best-effort and idempotent.
    func sweepMaps() async {
        guard DevFlags.aiModel1 else { return }
        // fetchAllEntries returns newest first, so `prefix` takes the most recent.
        let entries = (try? await journals.fetchAllEntries()) ?? []
        let needing = Array(entries.filter(\.needsCognitiveMap).prefix(Self.mapBackfillLimit))
        guard !needing.isEmpty else { return }
        Self.logger.notice("Map sweep: \(needing.count, privacy: .public) entr(ies) need a map")
        for entry in needing {
            await ensureMap(for: entry.id)
        }
    }

    /// In-flight / attempt key for a map generation, namespaced away from entry AI.
    private static func mapKey(_ entryID: String) -> String { "\(entryID)#map" }

    /// True when the entry lacks a summary OR has empty insights/prompts. Mirrors
    /// `JournalDetailViewModel.generateSummaryIfMissing` so the headless and lazy
    /// paths agree on what "needs AI" means (all three come from one call, so a
    /// summary-only entry — or one whose follow-up section came back empty —
    /// self-heals rather than showing a stuck Insights/Prompts tab; ADR-0081).
    static func needsAI(_ entry: JournalEntry) -> Bool {
        entry.summary == nil
            || (entry.insights?.text.isEmpty ?? true)
            || (entry.prompts?.items.isEmpty ?? true)
    }

    /// First value emitted by a stream, then let it terminate.
    private func firstEmission<T>(_ stream: AsyncStream<T>) async -> T? {
        for await value in stream { return value }
        return nil
    }

    /// Whether `error` is a cancellation (structured-concurrency or a cancelled URL
    /// task) rather than a genuine generation failure.
    private static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let urlError = error as? URLError, urlError.code == .cancelled { return true }
        return false
    }
}
