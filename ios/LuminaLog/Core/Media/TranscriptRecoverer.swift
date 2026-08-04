import Foundation
import OSLog

/// Re-transcribes a voice/video entry from its UPLOADED audio and persists the
/// result. Shared by two callers so the logic lives in one place:
///
/// - `EntryFinalizer` — AUTOMATICALLY, right after upload, when the on-device
///   transcription produced an empty/`.failed` transcript (a transient blip
///   during recording self-heals without the user lifting a finger).
/// - `JournalDetailViewModel.retryTranscription` — the MANUAL "Retry" button.
///
/// Zero-knowledge (Model 1): the server can't decrypt the audio, so we re-fetch
/// the clip from S3, decrypt it on-device (`media.localFileURL`), and transcribe
/// via the stateless `/transcribe-clip` endpoint. This works cross-launch because
/// the audio is durably on S3 — unlike the pre-upload transcription in the
/// pipeline, which is lost if the app is killed mid-call.
@MainActor
struct TranscriptRecoverer {
    let journals: JournalRepository
    let profiles: ProfileRepository
    let ai: AIService
    let media: MediaUploader

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "transcript-recover")

    /// True when `entry` is a voice/video entry whose transcript still needs to be
    /// produced — the on-device pass failed, returned nothing usable, or returned
    /// a result too short to be plausible for the recording's length (a word or
    /// two for a multi-minute clip, which used to be saved as a successful
    /// `.ready` transcript and never re-tried).
    static func needsTranscript(_ entry: JournalEntry) -> Bool {
        guard entry.type == .voice || entry.type == .video else { return false }
        // Terminal: the clip can't be transcribed (e.g. too large even after
        // chunking). The auto-backfill must NOT re-attempt it every launch — only
        // the manual Retry button (which bypasses this gate) does.
        if entry.transcriptStatus == .unsupported { return false }
        if entry.transcriptStatus == .failed { return true }
        let duration = entry.media.compactMap(\.durationSec).max()
        return !TranscriptPlausibility.isPlausible(entry.content, forDurationSec: duration)
    }

    /// Fetch → decrypt → transcribe the entry's audio and write the transcript +
    /// `.ready` status back (crediting the word delta to the lifetime odometer).
    /// Returns the updated entry on success, or `nil` when there's no usable clip
    /// or the transcription failed/was empty (the entry is left untouched so the
    /// caller keeps its `.failed` state and Retry affordance).
    @discardableResult
    func recover(_ entry: JournalEntry) async -> JournalEntry? {
        guard entry.type == .voice || entry.type == .video else { return nil }
        // Prefer the audio attachment; fall back to a video file's audio track.
        guard let clip = entry.media.first(where: { $0.kind == .audio })
            ?? entry.media.first(where: { $0.kind == .video }) else { return nil }

        do {
            let fileURL = try await media.localFileURL(for: clip.s3Key)
            let data = try Data(contentsOf: fileURL)
            let contentType = AudioContentType.mime(forPathExtension: (clip.s3Key as NSString).pathExtension)
            let transcript = try await ai.transcribeClip(audio: data, contentType: contentType)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            // Reject a result too short to be a plausible transcript of this clip
            // (a lone word for a multi-minute recording is a provider failure, not
            // a transcript). Leaving the entry untouched keeps its `.failed` state
            // + Retry affordance rather than saving the garbage as `.ready`.
            guard TranscriptPlausibility.isPlausible(transcript, forDurationSec: clip.durationSec) else { return nil }
            // Non-destructive: never overwrite existing content with a SHORTER
            // result (a re-transcription that came back worse than what we have).
            let existing = entry.content.trimmingCharacters(in: .whitespacesAndNewlines)
            guard WordCount.of(transcript) >= WordCount.of(existing) else { return nil }

            var updated = entry
            let oldWordCount = entry.wordCount
            updated.content = transcript
            updated.transcriptStatus = .ready
            updated.wordCount = WordCount.of(transcript)
            try await journals.save(updated)
            // Credit the word delta to the lifetime odometer (best-effort). Today's
            // goal progress + streak are reconciled from today's entries by the
            // app-level DailyGoalReconciler, so a failed-then-recovered transcription
            // correctly raises today's count.
            if updated.wordCount != oldWordCount {
                try? await profiles.addTotalWords(delta: updated.wordCount - oldWordCount)
            }
            return updated
        } catch {
            // A payload-too-large (413) is deterministic: retrying the same clip
            // every launch just re-uploads bytes that always fail. Mark it terminal
            // (`.unsupported`) so the auto-backfill stops; manual Retry still works.
            if (error as? ProxyAPIError)?.isPayloadTooLarge == true {
                Self.logger.error("clip too large to transcribe for \(entry.id, privacy: .public); marking unsupported")
                var terminal = entry
                terminal.transcriptStatus = .unsupported
                try? await journals.save(terminal)
                return nil
            }
            Self.logger.error("recover failed for \(entry.id, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
}
