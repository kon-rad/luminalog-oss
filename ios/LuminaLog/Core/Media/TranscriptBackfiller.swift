import Foundation
import OSLog

/// On-launch backfill for voice/video entries whose transcript failed or came
/// back degenerate (see `TranscriptRecoverer.needsTranscript`). Re-transcribes
/// from the durable S3 audio — the source of truth — and refreshes everything
/// derived from the transcript.
@MainActor
struct TranscriptBackfiller {
    let journals: JournalRepository
    let ai: AIService
    /// Re-transcribe step (wraps `TranscriptRecoverer.recover`). Returns the
    /// updated entry on success, or nil when there's no usable/plausible clip.
    let recover: (JournalEntry) async -> JournalEntry?

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "transcript-backfill")

    /// Re-transcribe every entry that needs it, then refresh its derived AI.
    /// Best-effort and idempotent: an entry that can't be recovered is left
    /// `.failed` (Retry still available) and simply retried on the next launch.
    ///
    /// `recover` already updates content/wordCount/status and — via its `save`
    /// through the indexing repository — re-embeds the entry, rebuilds the
    /// constellation, and feeds the daily-goal reconciler. Only the summary/
    /// insights/prompts, which nothing refreshes headlessly, are regenerated here.
    func backfill() async {
        let entries = (try? await journals.fetchAllEntries()) ?? []
        let needing = entries.filter(TranscriptRecoverer.needsTranscript)
        guard !needing.isEmpty else { return }
        Self.logger.notice("Backfilling \(needing.count, privacy: .public) transcript(s)")
        for entry in needing {
            guard let recovered = await recover(entry) else { continue }
            await regenerateDerivedAI(id: recovered.id)
        }
    }

    /// Regenerate the summary/insights/prompts derived from the now-corrected
    /// transcript. Best-effort: on failure the entry keeps its corrected content
    /// and simply shows the normal stale/Regenerate affordance.
    private func regenerateDerivedAI(id: String) async {
        guard DevFlags.aiModel1 else { return }
        do {
            let bundle = try await ai.generateEntryAI(journalId: id)
            try await journals.updateAIFields(
                id: id, summary: bundle.summary, insights: bundle.insights, prompts: bundle.prompts)
        } catch {
            Self.logger.error("derived AI regen failed for \(id, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
    }
}
