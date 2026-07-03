import Foundation
import OSLog

/// Drives the Journal Detail screen (design §4): live entry stream plus the
/// three AI actions (summary, insights, prompts) with exactly-one-in-flight
/// guards.
///
/// Persistence note: after every successful generation the result is written
/// back via `repository.updateAIFields`, which updates only the generated
/// field and fails (rather than recreating the document) when the entry was
/// deleted mid-generation. The production proxy ALSO persists server-side
/// (spec §4.1); this client-side write is for instant UI consistency and for
/// demo mode, where `MockAIService` does not write back to the repository.
@MainActor
final class JournalDetailViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "journal-detail")

    // MARK: - Published state

    /// The live entry — nil before the first emission and after deletion.
    @Published private(set) var entry: JournalEntry?

    @Published private(set) var summaryState: AIActionState = .idle
    /// State of the failed-transcript "Retry" action (voice/video entries
    /// whose on-device STT failed at create time).
    @Published private(set) var transcriptRetryState: AIActionState = .idle

    /// True once the first stream emission has landed (so the view can tell
    /// "loading" apart from "entry not found").
    @Published private(set) var hasLoaded = false

    /// Set true once the entry has been deleted so the view can pop.
    @Published private(set) var didDelete = false

    let entryId: String

    private let journals: JournalRepository
    private let ai: AIService

    private var liveTask: Task<Void, Never>?
    private var hasStarted = false

    init(
        entryId: String,
        journals: JournalRepository,
        ai: AIService
    ) {
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
                let hadContent = !(self.entry?.content ?? "").isEmpty
                self.entry = entry
                // Re-trigger summary generation when content becomes available
                // (e.g. voice/video transcript arrives after initial open).
                if !hadContent, let entry, !entry.content.isEmpty, entry.summary == nil {
                    Task { await self.generateSummaryIfMissing() }
                }
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
        guard let entry, entry.summary == nil, !entry.content.isEmpty else { return }
        await generateSummary()
    }

    func generateSummary() async {
        guard summaryState != .loading, entry != nil else { return }
        summaryState = .loading
        do {
            let generation = try await ai.generateSummary(journalId: entryId)
            try await persist(summary: generation)
            summaryState = .idle
        } catch {
            Self.logger.error("generateSummary failed: \(error.localizedDescription, privacy: .public)")
            summaryState = .failed
        }
    }

    // Insights and follow-up prompts are generated server-side together with the
    // summary at index time and stored on the entry; the client only displays
    // them (see `JournalDetailView.insightsTab` / `promptsTab`). There is no
    // client-side generation path for them.

    // MARK: - Transcript retry

    /// Re-runs server-side Whisper transcription for a voice/video entry.
    /// The server downloads the audio from S3, transcribes via Together AI
    /// Whisper, updates Firestore content + transcriptStatus, and re-indexes.
    /// The Firestore listener in `startLiveUpdates` picks up the update and
    /// refreshes the UI without any additional client-side work.
    func retryTranscription() async {
        guard transcriptRetryState != .loading, let entry else { return }
        guard entry.type == .voice || entry.type == .video else { return }

        transcriptRetryState = .loading
        do {
            try await ai.transcribeJournal(journalId: entryId)
            transcriptRetryState = .idle
        } catch {
            Self.logger.error("retryTranscription failed: \(error.localizedDescription, privacy: .public)")
            transcriptRetryState = .failed
        }
    }

    // MARK: - Exclude from share

    func setExcludeFromShare(_ value: Bool) {
        guard var e = entry else { return }
        e.excludeFromShare = value
        entry = e
        Task { try? await journals.setExcludeFromShare(entryId: e.id, value: value) }
    }

    // MARK: - Delete

    /// Best-effort delete: purge remote artifacts (S3 media + embeddings +
    /// summary) server-side, then always remove the Firestore record so the
    /// entry disappears from the user's list (spec delete policy).
    func delete() async {
        guard entry != nil else { return }
        do {
            try await ai.deleteEntry(journalId: entryId)
        } catch {
            Self.logger.error("""
            remote delete cleanup failed for \(self.entryId, privacy: .private); \
            removing record anyway: \(error.localizedDescription, privacy: .public)
            """)
        }
        do {
            try await journals.delete(id: entryId)
        } catch {
            Self.logger.error("""
            firestore delete failed for \(self.entryId, privacy: .private): \
            \(error.localizedDescription, privacy: .public)
            """)
        }
        didDelete = true
    }

    // MARK: - Persistence

    /// Writes the newly generated summary through to the repository
    /// (field-scoped, so a deleted entry is never recreated), then mirrors it
    /// onto the local snapshot for instant UI (see class docs).
    ///
    /// Only the summary is written client-side; insights and prompts are owned
    /// by the server (generated + stored at index time). A not-found failure
    /// means the entry was deleted mid-generation: the result is dropped
    /// silently — the live stream has already (or will) set `entry` to nil, so
    /// the view shows "Entry not found".
    private func persist(summary: AIGeneration) async throws {
        guard var updated = entry else { return }
        do {
            try await journals.updateAIFields(
                id: entryId,
                summary: summary,
                insights: nil,
                prompts: nil
            )
        } catch JournalRepositoryError.entryNotFound {
            Self.logger.notice("""
            entry \(self.entryId, privacy: .private) deleted mid-generation; \
            dropping AI result instead of recreating it
            """)
            return
        }
        updated.summary = summary
        entry = updated
    }
}
