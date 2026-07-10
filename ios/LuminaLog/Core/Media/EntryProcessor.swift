import Foundation
import OSLog

// MARK: - Job

/// A draft handed off from the Create screen to be processed in the background.
/// Carries everything the pipeline needs so it can outlive the (dismissed)
/// `CreateEntryViewModel`: typed text, staged attachments, and identity.
@MainActor
struct EntryProcessingJob {
    let draftId: String
    let userId: String
    let promptText: String?
    var attachments: AttachmentSet
    var text: String
    /// When the user tapped Save — becomes the entry's `createdAt` so it sorts
    /// into the list at the moment of saving, not when uploads finish.
    let createdAt: Date

    var type: JournalType { attachments.entryType }
}

// MARK: - Protocol

/// Runs the post-save upload/transcribe pipeline in the background and keeps
/// failed jobs around for in-session retry.
@MainActor
protocol EntryProcessor: AnyObject {
    /// Begin processing a freshly-saved draft (writes the entry immediately,
    /// then uploads/derives/transcribes).
    func enqueue(_ job: EntryProcessingJob)
    /// Re-run a job that previously failed (same draft id, cached successes).
    func retry(draftId: String)
    /// On launch, resume any durable upload journal records: finalize the ones
    /// whose uploads all completed (e.g. via a background-session relaunch), and
    /// restart uploads for the rest.
    func resumePendingJobs() async
}

// MARK: - Live implementation

/// Default `EntryProcessor`. Held by `AppServices` so its work survives the
/// Create screen dismissing. Writes `processingStatus` transitions to Firestore
/// (the list/detail stream them live) and, for voice/video, hands off to the
/// server transcription endpoint once the media exists on the saved entry.
@MainActor
final class BackgroundEntryProcessor: EntryProcessor {

    struct Dependencies {
        let journals: JournalRepository
        let profiles: ProfileRepository
        let ai: AIService
        let media: MediaUploader
        let ocr: OCRService
        let transcoder: VideoTranscoder
        let journal: UploadJournal
        let uploadManager: UploadManager
        let finalizer: EntryFinalizer
    }

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "processor")

    private let deps: Dependencies

    /// In-flight/failed jobs, keyed by draft id. Removed on success.
    private var jobs: [String: EntryProcessingJob] = [:]
    /// Running task per draft, exposed for tests to await completion.
    private var tasks: [String: Task<Void, Never>] = [:]

    // Per-draft caches so a retry only redoes the work that failed.
    private var uploadedItems: [String: [UUID: MediaItem]] = [:]
    private var derivedContent: [String: (content: String, status: TranscriptStatus?)] = [:]
    private var stagedTempURLs: [String: Set<URL>] = [:]

    /// Re-entrancy guard for `resumePendingJobs()`. The processor is `@MainActor`,
    /// so a simple bool check-and-set is race-free: two overlapping resume calls
    /// (e.g. launch + scene-activation) can't both process the same records and
    /// double-finalize. Set on entry, cleared via `defer`.
    private var isResuming = false

    init(dependencies: Dependencies) {
        self.deps = dependencies
    }

    // MARK: API

    func enqueue(_ job: EntryProcessingJob) {
        jobs[job.draftId] = job
        start(job)
    }

    func retry(draftId: String) {
        // In-session failed job: rerun the full pipeline (cached successes skip).
        if let job = jobs[draftId] {
            start(job)
            return
        }
        // Cross-launch: the in-memory job is gone, but a durable voice/video
        // upload record may survive. Restart its uploads from the journal.
        if let pending = deps.journal.entry(draftId: draftId) {
            tasks[draftId] = Task { [weak self] in
                await self?.deps.uploadManager.startAll(for: pending)
            }
        }
        // Text/image entries have no durable record; cross-launch retry of those
        // is unsupported (their staged bytes are gone). They remain `.failed`.
    }

    /// The running task for a draft (test hook).
    func task(for draftId: String) -> Task<Void, Never>? { tasks[draftId] }

    /// Whether a job is still tracked (in flight or retained after a failure).
    func hasPendingJob(draftId: String) -> Bool { jobs[draftId] != nil }

    // MARK: Pipeline

    private func start(_ job: EntryProcessingJob) {
        tasks[job.draftId] = Task { [weak self] in
            await self?.process(job)
        }
    }

    private func process(_ job: EntryProcessingJob) async {
        let type = job.type
        let isAudioVisual = (type == .voice || type == .video)

        // Voice/video route through the durable journal + background UploadManager
        // (with a shared finalizer); text/image stay on the inline path below.
        if isAudioVisual {
            await processAudioVisual(job)
            return
        }

        let typed = job.text.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = await resolvedTitle(for: job)

        var entry = JournalEntry(
            id: job.draftId,
            userId: job.userId,
            type: type,
            title: title,
            createdAt: job.createdAt,
            content: typed,
            media: [],
            transcriptStatus: nil,
            processingStatus: .processing,
            wordCount: WordCount.of(typed),
            promptText: job.promptText
        )

        // Pure-text entries settle instantly, so they skip the placeholder and
        // intermediate writes — one write, like the old synchronous path. Media
        // entries write a placeholder first so they appear in the list while the
        // upload/transcribe runs.
        let needsBackgroundWork = !job.attachments.isEmpty

        do {
            // 1) Write immediately so the entry appears in the list.
            if needsBackgroundWork {
                try await deps.journals.save(entry)
            }

            // 2) Derive canonical content (image OCR; voice/video stay typed).
            let derived = try await deriveContent(job)
            entry.content = derived.content
            entry.transcriptStatus = derived.status
            entry.wordCount = WordCount.of(derived.content)

            // 3) Upload staged media.
            if !job.attachments.isEmpty {
                entry.processingStatus = .uploading
                try await deps.journals.save(entry)
                entry.media = try await uploadAttachments(job)
            }

            // 4) Persist the final content + media, then settle the status.
            if needsBackgroundWork {
                entry.processingStatus = .saving
                try await deps.journals.save(entry)
            }

            entry.processingStatus = .ready
            try await deps.journals.save(entry)

            // 5) Side effects (best-effort; the entry is already saved).
            do {
                try await deps.profiles.recordEntrySaved(
                    wordCountDelta: entry.wordCount, on: entry.createdAt
                )
            } catch {
                Self.logger.error("recordEntrySaved failed: \(error)")
            }
            if job.promptText != nil {
                do { try await deps.profiles.recordPromptAnswered() }
                catch { Self.logger.error("recordPromptAnswered failed: \(error)") }
            }

            // Text/image just trigger a Chroma index of existing content.
            await deps.ai.requestIndex(journalId: entry.id)

            finish(job, cleanup: true)
        } catch {
            Self.logger.error("Background processing failed for \(job.draftId): \(error)")
            entry.processingStatus = .failed
            try? await deps.journals.save(entry)
            // Keep the job (and its caches/temp files) for an in-session retry.
        }
    }

    // MARK: Audio/video pipeline (durable journal + background manager)

    /// Voice/video path: stage encrypted ciphertext on disk + a durable journal
    /// record, write the entry as `.uploading`, then hand off to the background
    /// `UploadManager`. Finalization (status `.saving` → `.transcribing`, the
    /// transcription trigger, and `recordEntrySaved`) happens inside the manager
    /// via `onFinalize → finalizer.finalize` once every upload completes.
    private func processAudioVisual(_ job: EntryProcessingJob) async {
        let type = job.type
        let typed = job.text.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = await resolvedTitle(for: job)

        var entry = JournalEntry(
            id: job.draftId,
            userId: job.userId,
            type: type,
            title: title,
            createdAt: job.createdAt,
            content: typed,
            media: [],
            transcriptStatus: nil,
            processingStatus: .processing,
            wordCount: WordCount.of(typed),
            promptText: job.promptText
        )

        do {
            // 1) Placeholder write so the entry appears in the list immediately.
            try await deps.journals.save(entry)

            // 2) Derive content (voice/video stay typed text; transcript pending).
            let derived = try await deriveContent(job)
            entry.content = derived.content
            entry.transcriptStatus = derived.status
            entry.wordCount = WordCount.of(derived.content)

            // 3) Stage encrypted ciphertext + mint stable keys for each attachment.
            var uploads: [PendingUpload] = []

            if let video = job.attachments.video {
                // Transcode oversized video first; fall back to the original on failure.
                var sourceURL = video.url
                var transcodedURL: URL?
                if await deps.transcoder.shouldTranscode(source: video.url) {
                    let dest = FileManager.default.temporaryDirectory
                        .appendingPathComponent("\(UUID().uuidString).mp4")
                    do {
                        try await deps.transcoder.transcode(source: video.url, to: dest)
                        sourceURL = dest
                        transcodedURL = dest
                    } catch {
                        Self.logger.error("transcode failed, using original: \(error.localizedDescription)")
                    }
                }
                if let transcodedURL { track(transcodedURL, draftId: job.draftId) }

                let prepared = try await deps.media.prepareUpload(
                    fileURL: sourceURL, kind: .video, journalId: job.draftId)
                // Ciphertext temp files are owned by UploadManager (cleaned on
                // success; retained for the journal record on failure), so we do
                // NOT track them for processor cleanup here.
                var item = prepared.mediaItem
                item.durationSec = video.durationSec
                uploads.append(PendingUpload(
                    attachmentId: video.id, kind: .video, journalId: job.draftId,
                    s3Key: prepared.s3Key, encryptedPath: prepared.encryptedFileURL.path,
                    durationSec: video.durationSec, width: item.width, height: item.height,
                    thumbnailS3Key: item.thumbnailS3Key))
                let bytes = Self.fileSize(prepared.encryptedFileURL)
                // Follow-up: cache staged AV uploads per attachment to avoid re-recording media bytes on retry.
                try? await deps.profiles.recordMediaUploaded(kind: .video, bytes: bytes)
            }

            if let audio = job.attachments.audio {
                let prepared = try await deps.media.prepareUpload(
                    fileURL: audio.url, kind: .audio, journalId: job.draftId)
                // Ciphertext owned by UploadManager (see video branch above).
                var item = prepared.mediaItem
                item.durationSec = audio.durationSec
                uploads.append(PendingUpload(
                    attachmentId: audio.id, kind: .audio, journalId: job.draftId,
                    s3Key: prepared.s3Key, encryptedPath: prepared.encryptedFileURL.path,
                    durationSec: audio.durationSec, width: item.width, height: item.height,
                    thumbnailS3Key: item.thumbnailS3Key))
                let bytes = Self.fileSize(prepared.encryptedFileURL)
                // Follow-up: cache staged AV uploads per attachment to avoid re-recording media bytes on retry.
                try? await deps.profiles.recordMediaUploaded(kind: .audio, bytes: bytes)
            }

            // 4) Persist the durable journal record so uploads survive a relaunch.
            let pending = PendingEntry(
                draftId: job.draftId, userId: job.userId, type: type,
                title: entry.title, content: entry.content, wordCount: entry.wordCount,
                transcriptStatus: entry.transcriptStatus,
                createdAtEpoch: job.createdAt.timeIntervalSince1970,
                promptText: job.promptText, uploads: uploads)
            try deps.journal.upsert(pending)

            // 5) Mark the entry as uploading (media filled in by the finalizer).
            entry.processingStatus = .uploading
            entry.media = []
            try await deps.journals.save(entry)

            // 6) Upload in the background; finalize runs inside via onFinalize.
            await deps.uploadManager.startAll(for: pending)

            // 7) Clean up the transcoded temp + the staged original attachment
            //    files we created. (Ciphertext temp files are owned/cleaned by
            //    UploadManager on success.)
            finish(job, cleanup: true)
        } catch {
            Self.logger.error("AV processing failed for \(job.draftId): \(error)")
            entry.processingStatus = .failed
            try? await deps.journals.save(entry)
            // Keep the job (and its caches/temp files) for an in-session retry.
        }
    }

    func resumePendingJobs() async {
        // Re-entrancy guard: return early if a resume is already in flight so the
        // same durable records can't be finalized twice by overlapping calls.
        guard !isResuming else { return }
        isResuming = true
        defer { isResuming = false }

        for pending in deps.journal.allPending() {
            // FIX 1: Skip any draft that is currently tracked in-session. The
            // in-session path finalizes via UploadManager.onFinalize once its
            // uploads complete; resuming the SAME draft here would call
            // finalize a second time, and `recordEntrySaved` is an
            // unconditional Firestore increment — double-counting word/entry
            // stats. The processor tracks in-flight jobs in `jobs`/`tasks`.
            guard !hasPendingJob(draftId: pending.draftId) else { continue }

            // Backoff gating via `nextEarliestAttemptEpoch` is honored at the entry
            // level below (in the not-yet-uploaded branch) so a persistently-failing
            // upload doesn't re-attempt on every launch with no inter-launch delay.
            if pending.allUploaded {
                await deps.finalizer.finalize(pending)
                deps.journal.remove(draftId: pending.draftId)
            } else {
                // FIX 2: Ciphertext temp files live in the (purgeable) temporary
                // directory while the journal record is durable (Application
                // Support). If iOS purged a not-yet-uploaded ciphertext file,
                // `startAll` would PUT a missing file and burn `maxAttempts`
                // backed-off attempts before failing. Fail fast instead: if ANY
                // not-`.uploaded` upload's ciphertext is gone, mark the entry
                // `.failed` and drop the record so it isn't retried forever. The
                // user sees a failed entry they can re-record.
                let missingCiphertext = pending.uploads.contains { upload in
                    upload.state != .uploaded
                        && !FileManager.default.fileExists(atPath: upload.encryptedPath)
                }
                if missingCiphertext {
                    Self.logger.error("Resume fail-fast: missing ciphertext for \(pending.draftId); marking failed")
                    await markPendingFailed(pending)
                    deps.journal.remove(draftId: pending.draftId)
                    continue
                }
                // Honor the persisted `nextEarliestAttemptEpoch` backoff gate at the
                // entry level on launch: `UploadManager.bumpOrFail` stamps each failed
                // upload with `now + delay`, but without this check `startAll` would
                // re-attempt on EVERY launch with no inter-launch delay. If EVERY
                // not-yet-`.uploaded` upload is still within its backoff window, skip
                // starting this entry this launch — leave the journal record intact so
                // a later launch (past the gate) picks it up. If at least one upload is
                // due (gate in the past or zero), proceed to `startAll`. (Entry-level
                // skip only when ALL pending uploads are gated, so a single due upload
                // still drives the whole entry forward.)
                let now = Date().timeIntervalSince1970
                let pendingUploads = pending.uploads.filter { $0.state != .uploaded }
                let allGated = !pendingUploads.isEmpty
                    && pendingUploads.allSatisfy { $0.nextEarliestAttemptEpoch > now }
                if allGated {
                    continue
                }
                await deps.uploadManager.startAll(for: pending)
            }
        }
    }

    /// Write a durable journal record to Firestore as `.failed` (mirrors the
    /// `JournalEntry` shape `EntryFinalizer` builds) so a fail-fast resume
    /// surfaces a re-recordable failed entry instead of retrying forever.
    private func markPendingFailed(_ pending: PendingEntry) async {
        var entry = JournalEntry(
            id: pending.draftId, userId: pending.userId, type: pending.type,
            title: pending.title, createdAt: pending.createdAt, content: pending.content,
            media: pending.mediaItems, transcriptStatus: pending.transcriptStatus,
            processingStatus: .failed, wordCount: pending.wordCount)
        try? await deps.journals.save(entry)
    }

    // MARK: Content derivation

    /// Canonical content per type, cached per draft so a retry doesn't redo OCR.
    private func deriveContent(_ job: EntryProcessingJob) async throws -> (content: String, status: TranscriptStatus?) {
        if let cached = derivedContent[job.draftId] { return cached }
        let derived = try await computeDerivedContent(job)
        derivedContent[job.draftId] = derived
        return derived
    }

    private func computeDerivedContent(_ job: EntryProcessingJob) async throws -> (content: String, status: TranscriptStatus?) {
        let typed = job.text.trimmingCharacters(in: .whitespacesAndNewlines)

        switch job.type {
        case .text:
            return (typed, nil)

        case .image:
            var pieces: [String] = []
            var anyFailed = false
            for photo in job.attachments.photos {
                do {
                    let recognized = try await deps.ocr.recognizeText(in: photo.imageData)
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    if !recognized.isEmpty { pieces.append(recognized) }
                } catch {
                    Self.logger.error("OCR failed: \(error)")
                    anyFailed = true
                }
            }
            let joined = ([typed] + pieces)
                .filter { !$0.isEmpty }
                .joined(separator: "\n\n")
            return (joined, anyFailed ? .failed : .ready)

        case .voice, .video:
            // Model 1 (zero-knowledge): the server never persists the audio, but good
            // transcription needs a real model — so send the still-local recording to the
            // STATELESS /transcribe-clip endpoint (Together `whisper-large-v3`, transcribed
            // in memory and discarded) and store the returned text as content. This shares
            // the clip's plaintext audio with the AI provider for that one request, the same
            // "you choose what your AI sees" trade-off as chat/summary — see the privacy
            // audit. Non-ZK builds let server-side Whisper transcribe from S3 after save.
            if DevFlags.aiModel1 {
                guard let audioURL = job.attachments.audio?.url,
                      let audioData = try? Data(contentsOf: audioURL) else {
                    // Video-only or unreadable audio — don't leave the entry stuck "transcribing".
                    return (typed, typed.isEmpty ? .failed : .ready)
                }
                do {
                    let spoken = try await deps.ai.transcribeClip(audio: audioData, contentType: "audio/m4a")
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    let joined = ([typed, spoken].filter { !$0.isEmpty }).joined(separator: "\n\n")
                    // Whatever we got is final — there is no server re-pass to wait on.
                    return (joined, joined.isEmpty ? .failed : .ready)
                } catch {
                    Self.logger.error("clip transcription failed: \(error.localizedDescription)")
                    // Keep any typed text; the user can re-transcribe from the transcript editor.
                    return (typed, typed.isEmpty ? .failed : .ready)
                }
            }
            // Server-side Whisper transcribes after save; typed text saves now.
            return (typed, .processing)
        }
    }

    // MARK: Uploads

    /// Sequential uploads; any failure throws (the job is marked failed and
    /// retained). Successful uploads are cached per attachment id so a retry
    /// only re-uploads the items that actually failed.
    private func uploadAttachments(_ job: EntryProcessingJob) async throws -> [MediaItem] {
        let draftId = job.draftId
        var cache = uploadedItems[draftId] ?? [:]
        defer { uploadedItems[draftId] = cache }

        var items: [MediaItem] = []

        for photo in job.attachments.photos {
            if let cached = cache[photo.id] { items.append(cached); continue }
            let fileURL = try photo.writeToTemporaryFile()
            track(fileURL, draftId: draftId)
            let photoBytes = (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int) ?? 0
            var item = try await deps.media.upload(fileURL: fileURL, kind: .image, journalId: draftId)
            item.width = photo.pixelWidth
            item.height = photo.pixelHeight
            try? await deps.profiles.recordMediaUploaded(kind: .image, bytes: photoBytes)

            if let thumbData = photo.makeThumbnailData(),
               let thumbURL = try? photo.writeThumbnailToTemporaryFile(data: thumbData) {
                track(thumbURL, draftId: draftId)
                let thumbItem = try await deps.media.upload(fileURL: thumbURL, kind: .image, journalId: draftId)
                item.thumbnailS3Key = thumbItem.s3Key
                try? await deps.profiles.recordMediaUploaded(kind: .image, bytes: thumbData.count)
            }

            cache[photo.id] = item
            items.append(item)
        }

        if let video = job.attachments.video {
            if let cached = cache[video.id] {
                items.append(cached)
            } else {
                let videoBytes = (try? FileManager.default.attributesOfItem(atPath: video.url.path)[.size] as? Int) ?? 0
                var item = try await deps.media.upload(fileURL: video.url, kind: .video, journalId: draftId)
                item.durationSec = video.durationSec
                cache[video.id] = item
                items.append(item)
                try? await deps.profiles.recordMediaUploaded(kind: .video, bytes: videoBytes)
            }
        }

        if let audio = job.attachments.audio {
            if let cached = cache[audio.id] {
                items.append(cached)
            } else {
                let audioBytes = (try? FileManager.default.attributesOfItem(atPath: audio.url.path)[.size] as? Int) ?? 0
                var item = try await deps.media.upload(fileURL: audio.url, kind: .audio, journalId: draftId)
                item.durationSec = audio.durationSec
                cache[audio.id] = item
                items.append(item)
                try? await deps.profiles.recordMediaUploaded(kind: .audio, bytes: audioBytes)
            }
        }

        return items
    }

    // MARK: Temp-file lifecycle

    private func track(_ url: URL, draftId: String) {
        stagedTempURLs[draftId, default: []].insert(url)
    }

    private static func fileSize(_ url: URL) -> Int {
        ((try? FileManager.default.attributesOfItem(atPath: url.path))?[.size] as? NSNumber)?.intValue ?? 0
    }

    /// Drops a finished job and (on success) deletes its staged temp files plus
    /// the backing files of its video/audio attachments.
    private func finish(_ job: EntryProcessingJob, cleanup: Bool) {
        if cleanup {
            var urls = stagedTempURLs[job.draftId] ?? []
            if let video = job.attachments.video { urls.insert(video.url) }
            if let audio = job.attachments.audio { urls.insert(audio.url) }
            for url in urls { try? FileManager.default.removeItem(at: url) }
        }
        jobs[job.draftId] = nil
        tasks[job.draftId] = nil
        uploadedItems[job.draftId] = nil
        derivedContent[job.draftId] = nil
        stagedTempURLs[job.draftId] = nil
    }

    // MARK: Helpers

    /// Computes the entry title for a job: prompt text (first line, ≤80 chars)
    /// when answering a prompt, else a date-based title with a same-day suffix.
    private func resolvedTitle(for job: EntryProcessingJob) async -> String {
        if let promptText = job.promptText {
            return Self.promptTitle(promptText)
        }
        return await dateTitle(for: job.createdAt, excluding: job.draftId)
    }

    /// Date-based title for the given day. Appends " N" when N-1 other entries
    /// already exist on that calendar day (e.g. "June 26, 2026 2").
    private func dateTitle(for date: Date, excluding draftId: String) async -> String {
        let base = date.formatted(date: .long, time: .omitted)
        do {
            let count = try await deps.journals.countEntries(on: date, excluding: draftId)
            return count == 0 ? base : "\(base) \(count + 1)"
        } catch {
            Self.logger.error("countEntries failed: \(error.localizedDescription, privacy: .public)")
            return base
        }
    }

    /// First line of the prompt text, truncated to ≤80 chars.
    static func promptTitle(_ promptText: String) -> String {
        let firstLine = promptText
            .split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: true)
            .first
            .map { $0.trimmingCharacters(in: .whitespaces) }
            ?? promptText.trimmingCharacters(in: .whitespaces)
        return truncate(firstLine, to: 80)
    }

    private static func truncate(_ string: String, to limit: Int) -> String {
        guard string.count > limit else { return string }
        return String(string.prefix(limit - 1)).trimmingCharacters(in: .whitespaces) + "…"
    }
}
