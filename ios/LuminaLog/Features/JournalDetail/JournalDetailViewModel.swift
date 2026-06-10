import Foundation
import OSLog

/// Drives the Journal Detail screen (design §4): live entry stream plus the
/// three AI actions (summary, insights, prompts) with exactly-one-in-flight
/// guards.
///
/// Persistence note: after every successful generation the result is written
/// back onto the entry via `repository.save`. The production proxy ALSO
/// persists server-side (spec §4.1); this client-side save is for instant UI
/// consistency and for demo mode, where `MockAIService` does not write back
/// to the repository. The save is an idempotent overwrite either way.
@MainActor
final class JournalDetailViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "journal-detail")

    // MARK: - Published state

    /// The live entry — nil before the first emission and after deletion.
    @Published private(set) var entry: JournalEntry?

    /// True once the first stream emission has landed (so the view can tell
    /// "loading" apart from "entry not found").
    @Published private(set) var summaryState: AIActionState = .idle
    @Published private(set) var insightsState: AIActionState = .idle
    @Published private(set) var promptsState: AIActionState = .idle
    @Published private(set) var hasLoaded = false

    let entryId: String

    private let journals: JournalRepository
    private let ai: AIService

    private var liveTask: Task<Void, Never>?
    private var hasStarted = false

    init(entryId: String, journals: JournalRepository, ai: AIService) {
        self.entryId = entryId
        self.journals = journals
        self.ai = ai
    }

    deinit {
        liveTask?.cancel()
    }

    // MARK: - Lifecycle

    /// Awaits the first snapshot, starts live updates, then lazily generates
    /// the summary when the entry has none (spec §5.1: "summary generated on
    /// first open of detail view if nil"). Idempotent.
    func start() async {
        guard !hasStarted else { return }
        hasStarted = true

        // One-shot read: streams emit the current value immediately, so the
        // initial state is settled by the time this returns (testable).
        for await first in journals.entry(id: entryId) {
            entry = first
            break
        }
        hasLoaded = true

        startLiveUpdates()
        await generateSummaryIfMissing()
    }

    private func startLiveUpdates() {
        liveTask = Task { [weak self] in
            guard let stream = self?.journals.entry(id: self?.entryId ?? "") else { return }
            for await entry in stream {
                guard let self, !Task.isCancelled else { return }
                self.entry = entry
            }
        }
    }

    // MARK: - Summary

    /// True when the entry's text was edited after its summary was generated
    /// — gates the "Regenerate" affordance on the summary card (design §4).
    var isSummaryStale: Bool {
        guard
            let entry,
            let summary = entry.summary,
            let editedAt = entry.contentEditedAt
        else { return false }
        return editedAt > summary.generatedAt
    }

    private func generateSummaryIfMissing() async {
        guard let entry, entry.summary == nil else { return }
        await generateSummary()
    }

    func generateSummary() async {
        guard summaryState != .loading, entry != nil else { return }
        summaryState = .loading
        do {
            let generation = try await ai.generateSummary(journalId: entryId)
            try await persist { $0.summary = generation }
            summaryState = .idle
        } catch {
            Self.logger.error("generateSummary failed: \(error.localizedDescription, privacy: .public)")
            summaryState = .failed
        }
    }

    // MARK: - Insights

    func generateInsights() async {
        guard insightsState != .loading, entry != nil else { return }
        insightsState = .loading
        do {
            let generation = try await ai.generateInsights(journalId: entryId)
            try await persist { $0.insights = generation }
            insightsState = .idle
        } catch {
            Self.logger.error("generateInsights failed: \(error.localizedDescription, privacy: .public)")
            insightsState = .failed
        }
    }

    // MARK: - Prompts

    func generatePrompts() async {
        guard promptsState != .loading, entry != nil else { return }
        promptsState = .loading
        do {
            let items = try await ai.generatePrompts(journalId: entryId)
            try await persist { $0.prompts = AIPrompts(items: items) }
            promptsState = .idle
        } catch {
            Self.logger.error("generatePrompts failed: \(error.localizedDescription, privacy: .public)")
            promptsState = .failed
        }
    }

    // MARK: - Persistence

    /// Applies `mutate` to the latest entry snapshot, updates local state for
    /// instant UI, and writes through to the repository (see class docs).
    private func persist(_ mutate: (inout JournalEntry) -> Void) async throws {
        guard var updated = entry else { return }
        mutate(&updated)
        entry = updated
        try await journals.save(updated)
    }
}
