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
    /// produced — the on-device pass failed or returned nothing usable.
    static func needsTranscript(_ entry: JournalEntry) -> Bool {
        guard entry.type == .voice || entry.type == .video else { return false }
        return entry.transcriptStatus == .failed
            || entry.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
            guard !transcript.isEmpty else { return nil }

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
            Self.logger.error("recover failed for \(entry.id, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
}
