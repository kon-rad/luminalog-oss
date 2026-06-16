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
    }

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "processor")

    private let deps: Dependencies

    /// In-flight/failed jobs, keyed by draft id. Removed on success.
    private var jobs: [String: EntryProcessingJob] = [:]
    /// Running task per draft, exposed for tests to await completion.
    private var tasks: [String: Task<Void, Never>] = [:]

    // Per-draft caches so a retry only redoes the work that failed.
    private var uploadedItems: [String: [UUID: MediaItem]] = [:]
    private var derivedContent: [String: (content: String, status: TranscriptStatus?)] = [:]
    private var stagedTempURLs: [String: Set<URL>] = [:]

    init(dependencies: Dependencies) {
        self.deps = dependencies
    }

    // MARK: API

    func enqueue(_ job: EntryProcessingJob) {
        jobs[job.draftId] = job
        start(job)
    }

    func retry(draftId: String) {
        guard let job = jobs[draftId] else { return }
        start(job)
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
        let typed = job.text.trimmingCharacters(in: .whitespacesAndNewlines)
        let isAudioVisual = (type == .voice || type == .video)

        var entry = JournalEntry(
            id: job.draftId,
            userId: job.userId,
            type: type,
            title: Self.title(promptText: job.promptText, content: typed),
            createdAt: job.createdAt,
            content: typed,
            media: [],
            transcriptStatus: nil,
            processingStatus: .processing,
            wordCount: Self.wordCount(typed)
        )

        // Pure-text entries settle instantly, so they skip the placeholder and
        // intermediate writes — one write, like the old synchronous path. Media
        // entries write a placeholder first so they appear in the list while the
        // upload/transcribe runs.
        let needsBackgroundWork = !job.attachments.isEmpty || isAudioVisual

        do {
            // 1) Write immediately so the entry appears in the list.
            if needsBackgroundWork {
                try await deps.journals.save(entry)
            }

            // 2) Derive canonical content (image OCR; voice/video stay typed).
            let derived = try await deriveContent(job)
            entry.content = derived.content
            entry.transcriptStatus = derived.status
            entry.title = Self.title(promptText: job.promptText, content: derived.content)
            entry.wordCount = Self.wordCount(derived.content)

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

            entry.processingStatus = isAudioVisual ? .transcribing : .ready
            try await deps.journals.save(entry)

            // 5) Side effects (best-effort; the entry is already saved).
            do {
                try await deps.profiles.recordEntrySaved(
                    wordCountDelta: entry.wordCount, on: entry.createdAt
                )
            } catch {
                Self.logger.error("recordEntrySaved failed: \(error)")
            }

            // Voice/video use server Whisper, which also re-indexes to Chroma.
            // Everything else just triggers a Chroma index of existing content.
            if isAudioVisual {
                try? await deps.ai.transcribeJournal(journalId: entry.id)
            } else {
                await deps.ai.requestIndex(journalId: entry.id)
            }

            finish(job, cleanup: true)
        } catch {
            Self.logger.error("Background processing failed for \(job.draftId): \(error)")
            entry.processingStatus = .failed
            try? await deps.journals.save(entry)
            // Keep the job (and its caches/temp files) for an in-session retry.
        }
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
            var item = try await deps.media.upload(fileURL: fileURL, kind: .image, journalId: draftId)
            item.width = photo.pixelWidth
            item.height = photo.pixelHeight

            if let thumbData = photo.makeThumbnailData(),
               let thumbURL = try? photo.writeThumbnailToTemporaryFile(data: thumbData) {
                track(thumbURL, draftId: draftId)
                let thumbItem = try await deps.media.upload(fileURL: thumbURL, kind: .image, journalId: draftId)
                item.thumbnailS3Key = thumbItem.s3Key
            }

            cache[photo.id] = item
            items.append(item)
        }

        if let video = job.attachments.video {
            if let cached = cache[video.id] {
                items.append(cached)
            } else {
                var item = try await deps.media.upload(fileURL: video.url, kind: .video, journalId: draftId)
                item.durationSec = video.durationSec
                cache[video.id] = item
                items.append(item)
            }
        }

        if let audio = job.attachments.audio {
            if let cached = cache[audio.id] {
                items.append(cached)
            } else {
                var item = try await deps.media.upload(fileURL: audio.url, kind: .audio, journalId: draftId)
                item.durationSec = audio.durationSec
                cache[audio.id] = item
                items.append(item)
            }
        }

        return items
    }

    // MARK: Temp-file lifecycle

    private func track(_ url: URL, draftId: String) {
        stagedTempURLs[draftId, default: []].insert(url)
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

    private static func wordCount(_ content: String) -> Int {
        content.split(whereSeparator: \.isWhitespace).count
    }

    /// Title rule (mirrors the Create flow): the prompt question (≤80 chars)
    /// when answering a prompt, else the first non-empty content line (≤80),
    /// else the formatted date.
    static func title(promptText: String?, content: String) -> String {
        if let promptText {
            return truncate(promptText, to: 80)
        }
        let firstLine = content
            .split(separator: "\n", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first { !$0.isEmpty }
        if let firstLine {
            return truncate(firstLine, to: 80)
        }
        return Date().formatted(date: .long, time: .omitted)
    }

    private static func truncate(_ string: String, to limit: Int) -> String {
        guard string.count > limit else { return string }
        return String(string.prefix(limit - 1)).trimmingCharacters(in: .whitespaces) + "…"
    }
}
