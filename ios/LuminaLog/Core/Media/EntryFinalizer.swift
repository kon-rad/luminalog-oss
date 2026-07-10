import Foundation
import OSLog

/// Shared finalize step for a media entry once all of its uploads have
/// completed — invoked in-session (via `UploadManager.onFinalize`) OR after a
/// relaunch (via `EntryProcessor.resumePendingJobs`). Writes the entry's final
/// `media`/status to Firestore and triggers transcription/indexing.
///
/// NOTE: `recordMediaUploaded` stats are recorded by the processor at enqueue
/// time (the byte counts are known then), so the finalizer must NOT record them
/// again — only `recordEntrySaved`, which is keyed to a single save.
@MainActor
struct EntryFinalizer {
    let journals: JournalRepository
    let profiles: ProfileRepository
    let ai: AIService
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
            do { try await profiles.recordEntrySaved(wordCountDelta: entry.wordCount, on: entry.createdAt) }
            catch { Self.logger.error("recordEntrySaved failed: \(error.localizedDescription)") }
            if pending.promptText != nil {
                do { try await profiles.recordPromptAnswered() }
                catch { Self.logger.error("recordPromptAnswered failed: \(error.localizedDescription)") }
            }
            if awaitsServerTranscription { try? await ai.transcribeJournal(journalId: entry.id) }
            else { await ai.requestIndex(journalId: entry.id) }
        } catch {
            Self.logger.error("finalize failed for \(pending.draftId): \(error.localizedDescription)")
            entry.processingStatus = .failed
            try? await journals.save(entry)
        }
    }
}
