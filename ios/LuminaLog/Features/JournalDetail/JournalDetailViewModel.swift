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

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "journal-detail")

    // MARK: - Published state

    /// The live entry — nil before the first emission and after deletion.
    @Published private(set) var entry: JournalEntry?

    @Published private(set) var summaryState: AIActionState = .idle
    @Published private(set) var insightsState: AIActionState = .idle
    @Published private(set) var promptsState: AIActionState = .idle
    /// State of the failed-transcript "Retry" action (voice/video entries
    /// whose on-device STT failed at create time).
    @Published private(set) var transcriptRetryState: AIActionState = .idle

    /// True once the first stream emission has landed (so the view can tell
    /// "loading" apart from "entry not found").
    @Published private(set) var hasLoaded = false

    let entryId: String

    private let journals: JournalRepository
    private let ai: AIService
    private let media: MediaUploader
    private let speech: SpeechTranscriber
    /// Extracts a video's audio track to a temp file for transcription.
    /// Injected so tests can exercise re-transcription without AVFoundation
    /// (matches the `CreateEntryDependencies.extractAudio` pattern).
    private let extractAudio: (URL) async throws -> URL

    private var liveTask: Task<Void, Never>?
    private var hasStarted = false

    init(
        entryId: String,
        journals: JournalRepository,
        ai: AIService,
        media: MediaUploader,
        speech: SpeechTranscriber,
        extractAudio: @escaping (URL) async throws -> URL = AudioExtractor.extractAudio(from:)
    ) {
        self.entryId = entryId
        self.journals = journals
        self.ai = ai
        self.media = media
        self.speech = speech
        self.extractAudio = extractAudio
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
            try await persist(summary: generation)
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
            try await persist(insights: generation)
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
            try await persist(prompts: AIPrompts(items: items))
            promptsState = .idle
        } catch {
            Self.logger.error("generatePrompts failed: \(error.localizedDescription, privacy: .public)")
            promptsState = .failed
        }
    }

    // MARK: - Transcript retry

    /// Re-runs on-device STT for a voice/video entry whose transcription
    /// failed at create time (`transcriptStatus == .failed`).
    ///
    /// Content-replacement choice: on success the entry's `content` is
    /// REPLACED with the new transcript. A failed entry's content is only
    /// ever the typed-text fallback from the Create flow (the transcript was
    /// never produced), and we deliberately keep the rule simple rather than
    /// trying to preserve a typed prefix — the transcript becomes the
    /// canonical text, exactly as it would have at create time with no typed
    /// text.
    func retryTranscription() async {
        guard transcriptRetryState != .loading, let entry else { return }
        guard entry.type == .voice || entry.type == .video else { return }
        let mediaKind: MediaKind = entry.type == .video ? .video : .audio
        guard let item = entry.media.first(where: { $0.kind == mediaKind }) else { return }

        transcriptRetryState = .loading

        // Temp files created along the way (remote download, extracted
        // audio); always cleaned up, success or failure.
        var tempURLs: [URL] = []
        defer {
            for url in tempURLs {
                try? FileManager.default.removeItem(at: url)
            }
        }

        do {
            // Resolve the stored media to a local file the recognizer can
            // read: local file URLs (demo mode) pass through; remote URLs
            // (S3 presigned) are downloaded to a temp file first.
            let resolved = try await media.viewURL(for: item.s3Key)
            let localURL: URL
            if resolved.isFileURL {
                localURL = resolved
            } else {
                let (downloaded, _) = try await URLSession.shared.download(from: resolved)
                let ext = resolved.pathExtension.isEmpty
                    ? (mediaKind == .video ? "mp4" : "m4a")
                    : resolved.pathExtension
                let destination = FileManager.default.temporaryDirectory
                    .appendingPathComponent("\(UUID().uuidString).\(ext)")
                try FileManager.default.moveItem(at: downloaded, to: destination)
                tempURLs.append(destination)
                localURL = destination
            }

            // Video → extract the audio track first (same as Create flow).
            let audioURL: URL
            if entry.type == .video {
                audioURL = try await extractAudio(localURL)
                tempURLs.append(audioURL)
            } else {
                audioURL = localURL
            }

            guard await speech.requestAuthorization() else {
                throw SpeechTranscriberError.notAuthorized
            }
            let transcript = try await speech.transcribeFile(url: audioURL)
                .trimmingCharacters(in: .whitespacesAndNewlines)

            // Persist based on the LATEST streamed entry (it may have been
            // edited while transcribing); a deleted entry drops the result.
            guard var latest = self.entry else {
                transcriptRetryState = .idle
                return
            }
            latest.content = transcript
            latest.transcriptStatus = .ready
            latest.wordCount = transcript.split(whereSeparator: \.isWhitespace).count
            try await journals.save(latest)
            self.entry = latest
            transcriptRetryState = .idle
            Task { await ai.requestIndex(journalId: entryId) }
        } catch {
            Self.logger.error("retryTranscription failed: \(error.localizedDescription, privacy: .public)")
            transcriptRetryState = .failed
        }
    }

    // MARK: - Persistence

    /// Writes the newly generated field(s) through to the repository
    /// (field-scoped, so a deleted entry is never recreated), then mirrors
    /// them onto the local snapshot for instant UI (see class docs).
    ///
    /// A not-found failure means the entry was deleted mid-generation: the
    /// result is dropped silently — the live stream has already (or will)
    /// set `entry` to nil, so the view shows "Entry not found".
    private func persist(
        summary: AIGeneration? = nil,
        insights: AIGeneration? = nil,
        prompts: AIPrompts? = nil
    ) async throws {
        guard var updated = entry else { return }
        do {
            try await journals.updateAIFields(
                id: entryId,
                summary: summary,
                insights: insights,
                prompts: prompts
            )
        } catch JournalRepositoryError.entryNotFound {
            Self.logger.notice("""
            entry \(self.entryId, privacy: .private) deleted mid-generation; \
            dropping AI result instead of recreating it
            """)
            return
        }
        if let summary { updated.summary = summary }
        if let insights { updated.insights = insights }
        if let prompts { updated.prompts = prompts }
        entry = updated
    }
}
