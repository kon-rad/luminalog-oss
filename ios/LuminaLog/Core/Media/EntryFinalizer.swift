import Foundation
import OSLog

/// Shared finalize step for a media entry once all of its uploads have
/// completed — invoked in-session (via `UploadManager.onFinalize`) OR after a
/// relaunch (via `EntryProcessor.resumePendingJobs`). Writes the entry's final
/// `media`/status to Firestore and triggers transcription/indexing.
///
/// NOTE: `recordMediaUploaded` stats are recorded by the processor at enqueue
/// time (the byte counts are known then), so the finalizer must NOT record them
/// again — only `addTotalWords`, which is keyed to a single save.
@MainActor
struct EntryFinalizer {
    let journals: JournalRepository
    let profiles: ProfileRepository
    let ai: AIService
    /// Auto-recovers a failed/empty voice transcript from the now-uploaded S3
    /// audio (see `TranscriptRecoverer`). Optional so mock/test wiring can omit it
    /// (auto-recovery is simply skipped); `live()` always provides one.
    var recoverer: TranscriptRecoverer? = nil
    /// The durable draft store, so a media entry's retained (handed-off) draft is
    /// deleted once its uploads finalize successfully. Optional for mock/test
    /// wiring that doesn't exercise draft retention.
    var drafts: DraftStore? = nil
    /// Generates the entry's summary/insights/prompts HEADLESSLY once its content is
    /// final, so a saved voice/media entry gets its AI right away instead of only when
    /// the user opens its detail view. Optional so mock/test wiring can omit it (the
    /// launch sweep still backfills); `live()` always provides one.
    var aiGenerator: EntryAIGenerator? = nil
    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "finalizer")

    func finalize(_ pending: PendingEntry) async {
        // On the zero-knowledge path the audio was already transcribed ON DEVICE during
        // `EntryProcessor.deriveContent`, so there is no server re-transcription to wait
        // on — treat voice/video like any ready entry (else it stays stuck "transcribing").
        let awaitsServerTranscription = (pending.type == .voice || pending.type == .video) && !DevFlags.aiModel1
        var entry = JournalEntry(
            id: pending.draftId, userId: pending.userId, type: pending.type,
            title: pending.title, createdAt: pending.createdAt, content: pending.content,
            media: pending.mediaItems, transcriptStatus: pending.transcriptStatus,
            processingStatus: .saving, wordCount: pending.wordCount,
            promptText: pending.promptText)
        do {
            try await journals.save(entry)
            entry.processingStatus = awaitsServerTranscription ? .transcribing : .ready
            try await journals.save(entry)
            do { try await profiles.addTotalWords(delta: entry.wordCount) }
            catch { Self.logger.error("addTotalWords failed: \(error.localizedDescription)") }
            if pending.promptText != nil {
                do { try await profiles.recordPromptAnswered() }
                catch { Self.logger.error("recordPromptAnswered failed: \(error.localizedDescription)") }
            }
            if awaitsServerTranscription {
                try? await ai.transcribeJournal(journalId: entry.id)
            } else {
                // Zero-knowledge path: the audio is now durably on S3. If the
                // pre-upload on-device transcription failed or came back empty
                // (a transient network blip during recording), auto-recover it
                // from S3 now — no user action, resumable across launches. Index
                // AFTER recovery so the entry is searchable with its transcript.
                if let recoverer, TranscriptRecoverer.needsTranscript(entry),
                   let recovered = await recoverer.recover(entry) {
                    entry = recovered
                }
                await ai.requestIndex(journalId: entry.id)
            }
            // Content is now final (transcript recovered for voice/video, typed body
            // otherwise), so generate the entry's summary/insights/prompts headlessly
            // — the entry no longer waits to be opened to get its AI. Best-effort;
            // skipped for empty content, and the launch sweep is the safety net if the
            // app is backgrounded past the ~30s assertion mid-generation.
            if !entry.content.isEmpty {
                await aiGenerator?.ensureAI(for: entry.id)
            }
            // The entry is now durable (Firestore + S3), so its retained handed-off
            // draft — kept only as the cross-launch retry source — is no longer
            // needed. On the catch path we deliberately KEEP it so Retry can rebuild.
            drafts?.delete(pending.draftId)
        } catch {
            Self.logger.error("finalize failed for \(pending.draftId): \(error.localizedDescription)")
            entry.processingStatus = .failed
            try? await journals.save(entry)
        }
    }

    /// Flip a media entry to `.failed` in Firestore — used when its uploads
    /// permanently fail (`UploadManager.onPermanentFailure`). Without this the
    /// entry stays stuck at "Uploading…" forever; marking it `.failed` surfaces
    /// the in-app Retry affordance (which is gated on `.failed`). Mirrors the
    /// entry shape `finalize` builds so the list/detail views render it correctly.
    func markFailed(_ pending: PendingEntry) async {
        let entry = JournalEntry(
            id: pending.draftId, userId: pending.userId, type: pending.type,
            title: pending.title, createdAt: pending.createdAt, content: pending.content,
            media: pending.mediaItems, transcriptStatus: pending.transcriptStatus,
            processingStatus: .failed, wordCount: pending.wordCount,
            promptText: pending.promptText)
        do { try await journals.save(entry) }
        catch { Self.logger.error("markFailed save failed for \(pending.draftId): \(error.localizedDescription)") }
    }
}
