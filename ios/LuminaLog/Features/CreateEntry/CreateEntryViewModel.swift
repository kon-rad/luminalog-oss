import Foundation
import OSLog

// MARK: - Dependencies

/// The services the Create flow needs, bundled so the view-model init stays
/// sane and tests can inject mocks piecemeal.
@MainActor
struct CreateEntryDependencies {
    let auth: AuthService
    let journals: JournalRepository
    let profiles: ProfileRepository
    let ai: AIService
    let media: MediaUploader
    let speech: SpeechTranscriber
    let ocr: OCRService

    init(
        auth: AuthService,
        journals: JournalRepository,
        profiles: ProfileRepository,
        ai: AIService,
        media: MediaUploader,
        speech: SpeechTranscriber,
        ocr: OCRService
    ) {
        self.auth = auth
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
        self.media = media
        self.speech = speech
        self.ocr = ocr
    }

    init(services: AppServices) {
        self.init(
            auth: services.auth,
            journals: services.journals,
            profiles: services.profiles,
            ai: services.ai,
            media: services.media,
            speech: services.speech,
            ocr: services.ocr
        )
    }
}

// MARK: - View model

/// Drives the Create Journal Entry screen (design §5): editor text, live
/// dictation, staged attachments, and the save pipeline (spec §5.1).
@MainActor
final class CreateEntryViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "create")

    /// Save-progress phases shown while inputs are disabled.
    enum SavingPhase: String {
        case transcribing = "Transcribing…"
        case uploading = "Uploading…"
        case saving = "Saving…"
    }

    enum DictationState: Equatable {
        case idle
        case listening
    }

    /// Save failure surfaced as a Retry/Cancel alert (the entry is not saved
    /// until uploads + the Firestore write succeed).
    struct SaveError: Identifiable, Equatable {
        let id = UUID()
        let message: String
    }

    // MARK: Published state

    @Published var text = ""
    @Published var attachments = AttachmentSet()
    /// Inline notice from attachment rules (e.g. "audio dropped").
    @Published var attachmentNotice: String?
    @Published private(set) var dictationState: DictationState = .idle
    @Published var showDictationDeniedAlert = false
    /// Internal-settable so previews can show the saving state.
    @Published var savingPhase: SavingPhase?
    @Published var saveError: SaveError?
    /// Flips true after a successful save; the view dismisses on it.
    @Published private(set) var didSave = false

    // MARK: Dependencies & identity

    let promptText: String?

    private let deps: CreateEntryDependencies
    /// Stable across save retries so a retried upload reuses the same id.
    private let draftId = UUID().uuidString

    /// Exposed for tests to await dictation-stream consumption.
    private(set) var dictationTask: Task<Void, Never>?
    /// Identifies the current dictation session so a finishing old session
    /// can never clobber the state/text of a newer one.
    private var dictationSessionId = UUID()
    /// Exposed for tests to await the fire-and-forget index request.
    private(set) var indexTask: Task<Void, Never>?

    init(request: CreateEntryRequest, dependencies: CreateEntryDependencies) {
        let trimmedPrompt = request.promptText?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        self.promptText = (trimmedPrompt?.isEmpty ?? true) ? nil : trimmedPrompt
        self.deps = dependencies
    }

    // MARK: Derived state

    var isSaving: Bool { savingPhase != nil }

    private var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var hasUnsavedContent: Bool {
        !trimmedText.isEmpty || !attachments.isEmpty
    }

    var canSave: Bool {
        hasUnsavedContent && !isSaving
    }

    var entryType: JournalType { attachments.entryType }

    // MARK: - Live dictation

    /// Starts a dictation session. Partial transcripts are *cumulative*, so
    /// each partial replaces the current session segment: we snapshot the
    /// editor text at session start (`base`) and set `text = base + partial`.
    func startDictation() async {
        guard dictationState == .idle, !isSaving else { return }
        guard await deps.speech.requestAuthorization() else {
            showDictationDeniedAlert = true
            return
        }

        let base = dictationBase(from: text)
        let sessionId = UUID()
        dictationSessionId = sessionId
        dictationState = .listening
        let stream = deps.speech.startLiveTranscription()

        dictationTask = Task { [weak self] in
            do {
                for try await partial in stream {
                    guard let self,
                          self.dictationSessionId == sessionId,
                          self.dictationState == .listening
                    else { return }
                    self.text = base + partial
                }
            } catch is SpeechTranscriberError {
                // Authorization/availability problems → point at Settings.
                self?.showDictationDeniedAlert = true
            } catch {
                Self.logger.error("Dictation stream failed: \(error)")
            }
            if let self, self.dictationSessionId == sessionId {
                self.dictationState = .idle
            }
        }
    }

    func stopDictation() {
        guard dictationState == .listening else { return }
        deps.speech.stopLiveTranscription()
        dictationState = .idle
    }

    func toggleDictation() async {
        if dictationState == .listening {
            stopDictation()
        } else {
            await startDictation()
        }
    }

    /// Editor text the session appends after — existing text plus a
    /// separating space when it doesn't already end in whitespace.
    private func dictationBase(from current: String) -> String {
        guard !current.isEmpty else { return "" }
        if let last = current.last, last.isWhitespace { return current }
        return current + " "
    }

    // MARK: - Attachment intents

    func addPhotos(_ photos: [PhotoAttachment]) {
        guard !photos.isEmpty else { return }
        attachmentNotice = attachments.addPhotos(photos)
    }

    func attachVideo(_ video: VideoAttachment) {
        attachments.setVideo(video)
    }

    func attachAudio(_ audio: AudioAttachment) {
        attachmentNotice = attachments.setAudio(audio)
    }

    // MARK: - Save pipeline (spec §5.1)

    /// 1) derive canonical content (OCR / STT), 2) upload media, 3) save the
    /// entry, 4) bump profile stats, 5) fire-and-forget RAG indexing.
    func save() async {
        guard canSave else { return }
        guard let userId = deps.auth.currentUserId else {
            saveError = SaveError(message: AuthServiceError.notSignedIn.localizedDescription)
            return
        }

        stopDictation()
        saveError = nil
        let type = attachments.entryType

        do {
            savingPhase = type == .text ? .saving : .transcribing
            let derived = await deriveContent(type: type)

            if !attachments.isEmpty { savingPhase = .uploading }
            let media = try await uploadAttachments()

            savingPhase = .saving
            let wordCount = derived.content
                .split(whereSeparator: \.isWhitespace)
                .count

            let entry = JournalEntry(
                id: draftId,
                userId: userId,
                type: type,
                title: title(for: derived.content),
                content: derived.content,
                media: media,
                transcriptStatus: derived.status,
                wordCount: wordCount
            )
            try await deps.journals.save(entry)

            // The entry is already saved; a stats failure shouldn't scare the
            // user out of their journal. Log and move on.
            do {
                try await deps.profiles.recordEntrySaved(wordCountDelta: wordCount, on: Date())
            } catch {
                Self.logger.error("recordEntrySaved failed: \(error)")
            }

            let ai = deps.ai
            indexTask = Task { await ai.requestIndex(journalId: entry.id) }

            savingPhase = nil
            didSave = true
        } catch {
            savingPhase = nil
            saveError = SaveError(
                message: "Your entry couldn't be saved. \(error.localizedDescription)"
            )
        }
    }

    // MARK: Content derivation

    /// Canonical content per type (spec §5.1 step 2). STT/OCR failures don't
    /// block saving: the entry keeps the typed text with
    /// `transcriptStatus: .failed` so transcription can be retried later.
    private func deriveContent(type: JournalType) async -> (content: String, status: TranscriptStatus?) {
        let typed = trimmedText

        switch type {
        case .text:
            return (typed, nil)

        case .image:
            var pieces: [String] = []
            var anyFailed = false
            for photo in attachments.photos {
                do {
                    let recognized = try await deps.ocr.recognizeText(in: photo.imageData)
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    if !recognized.isEmpty { pieces.append(recognized) }
                } catch {
                    Self.logger.error("OCR failed: \(error)")
                    anyFailed = true
                }
            }
            // Typed editor text (if any) is prepended to the joined OCR text.
            let joined = ([typed] + pieces)
                .filter { !$0.isEmpty }
                .joined(separator: "\n\n")
            return (joined, anyFailed ? .failed : .ready)

        case .voice, .video:
            do {
                let audioURL: URL
                if type == .video, let video = attachments.video {
                    audioURL = try await AudioExtractor.extractAudio(from: video.url)
                } else if let audio = attachments.audio {
                    audioURL = audio.url
                } else {
                    return (typed, .failed)
                }
                guard await deps.speech.requestAuthorization() else {
                    throw SpeechTranscriberError.notAuthorized
                }
                let transcript = try await deps.speech.transcribeFile(url: audioURL)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                let content = [typed, transcript]
                    .filter { !$0.isEmpty }
                    .joined(separator: "\n\n")
                return (content, .ready)
            } catch {
                Self.logger.error("Transcription failed: \(error)")
                return (typed, .failed)
            }
        }
    }

    // MARK: Uploads

    /// Sequential uploads; any failure aborts the save (Retry/Cancel alert).
    private func uploadAttachments() async throws -> [MediaItem] {
        var items: [MediaItem] = []
        for photo in attachments.photos {
            let fileURL = try photo.writeToTemporaryFile()
            var item = try await deps.media.upload(
                fileURL: fileURL, kind: .image, journalId: draftId
            )
            item.width = photo.pixelWidth
            item.height = photo.pixelHeight
            items.append(item)
        }
        if let video = attachments.video {
            var item = try await deps.media.upload(
                fileURL: video.url, kind: .video, journalId: draftId
            )
            item.durationSec = video.durationSec
            items.append(item)
        }
        if let audio = attachments.audio {
            var item = try await deps.media.upload(
                fileURL: audio.url, kind: .audio, journalId: draftId
            )
            item.durationSec = audio.durationSec
            items.append(item)
        }
        return items
    }

    // MARK: Title

    /// Title rule: when the entry answers a prompt, the prompt question (≤80
    /// chars) becomes the title and the content stays pure. Otherwise the
    /// first non-empty content line (≤80 chars), else the formatted date.
    func title(for content: String) -> String {
        if let promptText {
            return Self.truncate(promptText, to: 80)
        }
        let firstLine = content
            .split(separator: "\n", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first { !$0.isEmpty }
        if let firstLine {
            return Self.truncate(firstLine, to: 80)
        }
        return Date().formatted(date: .long, time: .omitted)
    }

    private static func truncate(_ string: String, to limit: Int) -> String {
        guard string.count > limit else { return string }
        return String(string.prefix(limit - 1)).trimmingCharacters(in: .whitespaces) + "…"
    }
}
