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
        let isAV = (pending.type == .voice || pending.type == .video)
        var entry = JournalEntry(
            id: pending.draftId, userId: pending.userId, type: pending.type,
            title: pending.title, createdAt: pending.createdAt, content: pending.content,
            media: pending.mediaItems, transcriptStatus: pending.transcriptStatus,
            processingStatus: .saving, wordCount: pending.wordCount)
        do {
            try await journals.save(entry)
            entry.processingStatus = isAV ? .transcribing : .ready
            try await journals.save(entry)
            do { try await profiles.recordEntrySaved(wordCountDelta: entry.wordCount, on: entry.createdAt) }
            catch { Self.logger.error("recordEntrySaved failed: \(error.localizedDescription)") }
            if isAV { try? await ai.transcribeJournal(journalId: entry.id) }
            else { await ai.requestIndex(journalId: entry.id) }
        } catch {
            Self.logger.error("finalize failed for \(pending.draftId): \(error.localizedDescription)")
            entry.processingStatus = .failed
            try? await journals.save(entry)
        }
    }
}
