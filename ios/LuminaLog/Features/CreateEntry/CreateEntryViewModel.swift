import Combine
import Foundation
import OSLog
import UIKit

// MARK: - Dependencies

/// The services the Create flow needs. The save pipeline now runs in the
/// background `EntryProcessor`, so the view model only needs auth (to stamp the
/// draft), the speech transcriber (live dictation), and the processor to hand
/// the draft off to.
@MainActor
struct CreateEntryDependencies {
    let auth: AuthService
    let speech: SpeechTranscriber
    let entryProcessor: EntryProcessor
    let drafts: DraftStore

    init(auth: AuthService, speech: SpeechTranscriber, entryProcessor: EntryProcessor, drafts: DraftStore) {
        self.auth = auth
        self.speech = speech
        self.entryProcessor = entryProcessor
        self.drafts = drafts
    }

    init(services: AppServices) {
        self.init(
            auth: services.auth,
            speech: services.speech,
            entryProcessor: services.entryProcessor,
            drafts: services.drafts
        )
    }
}

// MARK: - View model

/// Drives the Create Journal Entry screen (design §5): editor text, live
/// dictation, staged attachments, and the save pipeline (spec §5.1).
@MainActor
final class CreateEntryViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "create")

    enum DictationState: Equatable {
        case idle
        case listening
    }

    // MARK: Published state

    @Published var text = ""
    @Published var attachments = AttachmentSet()
    /// Placeholder tiles for media still being fetched/decoded — one id per
    /// in-flight photo. Shown as gray spinners until the real thumbnail lands.
    @Published private(set) var loadingPhotoIDs: [UUID] = []
    /// Whether a picked video is still being fetched/poster-generated.
    @Published private(set) var isLoadingVideo = false
    /// Inline notice from attachment rules (e.g. "audio dropped").
    @Published var attachmentNotice: String?
    @Published private(set) var dictationState: DictationState = .idle
    @Published var showDictationDeniedAlert = false
    /// Flips true once the draft is handed to the background processor; the
    /// view dismisses on it. Upload/transcribe then continue without the UI.
    @Published private(set) var didSave = false

    // MARK: Dependencies & identity

    var promptText: String?

    private let deps: CreateEntryDependencies
    /// Stable id shared by the draft and its saved entry. Reused when resuming.
    private let draftId: String
    /// When resuming, the originating draft's createdAt (preserves list order).
    private var resumedCreatedAt: Date?
    /// Attachment ids already copied into the durable draft media dir.
    private var persistedAttachmentIDs: Set<UUID> = []
    private var autosaveCancellable: AnyCancellable?

    /// Exposed for tests to await dictation-stream consumption.
    private(set) var dictationTask: Task<Void, Never>?
    /// Identifies the current dictation session so a finishing old session
    /// can never clobber the state/text of a newer one.
    private var dictationSessionId = UUID()

    init(request: CreateEntryRequest, dependencies: CreateEntryDependencies) {
        let trimmedPrompt = request.promptText?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        self.promptText = (trimmedPrompt?.isEmpty ?? true) ? nil : trimmedPrompt
        self.deps = dependencies
        self.draftId = request.resumeDraftId ?? UUID().uuidString

        // Debounced autosave on text edits. Attachment intents persist eagerly.
        autosaveCancellable = $text
            .debounce(for: .seconds(0.7), scheduler: RunLoop.main)
            .sink { [weak self] _ in self?.persistDraftNow() }
    }

    // MARK: Derived state

    private var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var hasUnsavedContent: Bool {
        !trimmedText.isEmpty || !attachments.isEmpty
    }

    /// True while any picked media is still being fetched/decoded.
    var isLoadingMedia: Bool { !loadingPhotoIDs.isEmpty || isLoadingVideo }

    /// Whether the attachment strip has anything to show (resolved or loading).
    var hasVisibleAttachments: Bool { !attachments.isEmpty || isLoadingMedia }

    /// Save is blocked while media is loading so a not-yet-resolved item can't
    /// be dropped; it re-enables the instant the last load finishes.
    var canSave: Bool { hasUnsavedContent && !isLoadingMedia }

    var entryType: JournalType { attachments.entryType }

    // MARK: - Live dictation

    /// Starts a dictation session. Partial transcripts are *cumulative*, so
    /// each partial replaces the current session segment: we snapshot the
    /// editor text at session start (`base`) and set `text = base + partial`.
    func startDictation() async {
        guard dictationState == .idle else { return }
        // Capture base synchronously before any async suspension so the binding
        // always reads the current editor text, not a potentially stale snapshot.
        let base = dictationBase(from: text)
        guard await deps.speech.requestAuthorization() else {
            showDictationDeniedAlert = true
            return
        }
        let sessionId = UUID()
        dictationSessionId = sessionId
        dictationState = .listening
        let stream = deps.speech.startLiveTranscription()

        dictationTask = Task { [weak self] in
            var committed = base
            var lastPartial = ""
            do {
                for try await partial in stream {
                    guard let self,
                          self.dictationSessionId == sessionId,
                          self.dictationState == .listening
                    else { return }
                    // Detect Apple on-device mid-session reset (partial shrinks
                    // to <⅓ of previous without isFinal). Commit current text so
                    // the next partial appends rather than replaces.
                    if !lastPartial.isEmpty && partial.count < lastPartial.count / 3 {
                        let current = self.text
                        committed = current.isEmpty ? "" : (current.hasSuffix(" ") ? current : current + " ")
                    }
                    lastPartial = partial
                    self.text = committed + partial
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

    /// Video/audio attachments are backed by temp files this flow created
    /// (camera/library copies, recorder output), so removing or replacing an
    /// attachment deletes its backing file immediately.

    // MARK: Loading placeholders

    /// Stages `count` loading placeholders and returns their ids so the caller
    /// can resolve or drop each as its load completes (in selection order).
    func beginLoadingPhotos(count: Int) -> [UUID] {
        guard count > 0 else { return [] }
        let ids = (0..<count).map { _ in UUID() }
        loadingPhotoIDs.append(contentsOf: ids)
        return ids
    }

    /// Replaces a loading placeholder with its decoded photo.
    func resolveLoadingPhoto(id: UUID, photo: PhotoAttachment) {
        dropLoadingPhoto(id: id)
        addPhotos([photo])
    }

    /// Removes a loading placeholder whose item failed to load.
    func dropLoadingPhoto(id: UUID) {
        loadingPhotoIDs.removeAll { $0 == id }
    }

    func beginLoadingVideo() { isLoadingVideo = true }

    func endLoadingVideo() { isLoadingVideo = false }

    func addPhotos(_ photos: [PhotoAttachment]) {
        guard !photos.isEmpty else { return }
        let displacedAudioURL = attachments.audio?.url
        if let notice = attachments.addPhotos(photos) {
            attachmentNotice = notice
        }
        // Photos win over audio: when the rule dropped the recording, delete
        // its backing file too.
        if attachments.audio == nil, let displacedAudioURL {
            deleteTempFile(at: displacedAudioURL)
        }
        persistDraftNow()
    }

    func attachVideo(_ video: VideoAttachment) {
        if let old = attachments.video?.url, old != video.url {
            deleteTempFile(at: old)
        }
        if let oldAudio = attachments.audio?.url {
            deleteTempFile(at: oldAudio)
        }
        attachments.setVideo(video)
        persistDraftNow()
    }

    func attachAudio(_ audio: AudioAttachment) {
        let previousURL = attachments.audio?.url
        let notice = attachments.setAudio(audio)
        attachmentNotice = notice
        if notice != nil {
            // The recording wasn't kept (photos/video take priority).
            deleteTempFile(at: audio.url)
        } else if let previousURL, previousURL != audio.url {
            deleteTempFile(at: previousURL)
        }
        persistDraftNow()
    }

    func removePhoto(id: UUID) {
        attachments.removePhoto(id: id)
        persistDraftNow()
    }

    func removeVideo() {
        if let url = attachments.video?.url {
            deleteTempFile(at: url)
        }
        attachments.removeVideo()
        persistDraftNow()
    }

    func removeAudio() {
        if let url = attachments.audio?.url {
            deleteTempFile(at: url)
        }
        attachments.removeAudio()
        persistDraftNow()
    }

    /// Deletes the backing file of a picked video that was never attached
    /// (the user declined the replace confirmation).
    func discardUnattachedVideo(_ video: VideoAttachment) {
        deleteTempFile(at: video.url)
    }

    // MARK: - Temp file lifecycle

    /// Deletes the backing files of still-attached video/audio. Called on
    /// cancel/discard only — on save, the `EntryProcessor` takes ownership of
    /// the attachments and cleans their temp files up once uploaded.
    func cleanupTempFiles() {
        var urls: Set<URL> = []
        if let video = attachments.video { urls.insert(video.url) }
        if let audio = attachments.audio { urls.insert(audio.url) }
        for url in urls {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private func deleteTempFile(at url: URL) {
        try? FileManager.default.removeItem(at: url)
    }

    // MARK: - Draft persistence

    /// Hydrates state from a resumed draft: text, prompt, and attachments
    /// re-materialized from the durable media dir into fresh temp files (so the
    /// invariant "attachments reference temp files" holds for the save path).
    func loadResumedDraftIfNeeded() {
        guard let draft = deps.drafts.load(draftId) else { return }
        text = draft.text
        if let p = draft.promptText { promptText = p }
        resumedCreatedAt = draft.createdAt

        var photos: [PhotoAttachment] = []
        for desc in draft.attachments.sorted(by: { $0.order < $1.order }) {
            guard let durable = deps.drafts.mediaURL(draftId: draftId, fileName: desc.fileName) else { continue }
            switch desc.kind {
            case .photo:
                if let data = try? Data(contentsOf: durable) {
                    photos.append(PhotoAttachment(imageData: data,
                                                  thumbnail: UIImage(data: data),
                                                  pixelWidth: desc.pixelWidth,
                                                  pixelHeight: desc.pixelHeight))
                }
            case .audio:
                if let temp = try? copyToTemp(durable, ext: "m4a") {
                    _ = attachments.setAudio(AudioAttachment(url: temp, durationSec: desc.durationSec ?? 0))
                }
            case .video:
                if let temp = try? copyToTemp(durable, ext: durable.pathExtension) {
                    attachments.setVideo(VideoAttachment(url: temp, thumbnail: nil, durationSec: desc.durationSec))
                }
            }
            persistedAttachmentIDs.insert(desc.id)
        }
        if !photos.isEmpty { _ = attachments.addPhotos(photos) }
    }

    private func copyToTemp(_ source: URL, ext: String) throws -> URL {
        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).\(ext.isEmpty ? "dat" : ext)")
        try? FileManager.default.removeItem(at: dest)
        try FileManager.default.copyItem(at: source, to: dest)
        return dest
    }

    /// Persists the current composition to the durable draft store. Copies any
    /// not-yet-persisted attachment bytes into the draft media dir. Prunes the
    /// draft when there is nothing worth keeping.
    func persistDraftNow() {
        // Once saved, the entry is durable via the processor; never resurrect a draft.
        guard !didSave else { return }
        guard hasUnsavedContent else {
            deps.drafts.delete(draftId)
            return
        }
        var descriptors: [DraftAttachment] = []
        var order = 0

        for photo in attachments.photos {
            let fileName = "\(photo.id.uuidString).jpg"
            if !persistedAttachmentIDs.contains(photo.id) {
                _ = try? deps.drafts.saveMedia(draftId: draftId, fileName: fileName, data: photo.imageData)
                persistedAttachmentIDs.insert(photo.id)
            }
            descriptors.append(DraftAttachment(id: photo.id, kind: .photo, fileName: fileName,
                                               durationSec: nil, pixelWidth: photo.pixelWidth,
                                               pixelHeight: photo.pixelHeight, order: order))
            order += 1
        }
        if let video = attachments.video {
            let fileName = "\(video.id.uuidString).\(video.url.pathExtension.isEmpty ? "mov" : video.url.pathExtension)"
            if !persistedAttachmentIDs.contains(video.id) {
                _ = try? deps.drafts.importMedia(draftId: draftId, fileName: fileName, from: video.url)
                persistedAttachmentIDs.insert(video.id)
            }
            descriptors.append(DraftAttachment(id: video.id, kind: .video, fileName: fileName,
                                               durationSec: video.durationSec, pixelWidth: nil,
                                               pixelHeight: nil, order: order))
            order += 1
        }
        if let audio = attachments.audio {
            let fileName = "\(audio.id.uuidString).m4a"
            if !persistedAttachmentIDs.contains(audio.id) {
                _ = try? deps.drafts.importMedia(draftId: draftId, fileName: fileName, from: audio.url)
                persistedAttachmentIDs.insert(audio.id)
            }
            descriptors.append(DraftAttachment(id: audio.id, kind: .audio, fileName: fileName,
                                               durationSec: audio.durationSec, pixelWidth: nil,
                                               pixelHeight: nil, order: order))
            order += 1
        }

        let now = Date()
        let draft = DraftEntry(
            draftId: draftId,
            text: text,
            promptText: promptText,
            createdAtEpoch: (resumedCreatedAt ?? now).timeIntervalSince1970,
            updatedAtEpoch: now.timeIntervalSince1970,
            attachments: descriptors
        )
        deps.drafts.upsert(draft)
    }

    /// Explicit user discard: removes the draft + its durable media, and the
    /// still-attached temp files.
    func discardDraft() {
        autosaveCancellable = nil
        deps.drafts.delete(draftId)
        cleanupTempFiles()
    }

    // MARK: - Save (hand off to the background processor)

    /// Packages the draft and hands it to the `EntryProcessor`, then dismisses
    /// immediately. Upload, OCR, the Firestore write, and transcription all run
    /// in the background; progress surfaces via the entry's `processingStatus`.
    func save() {
        guard canSave else { return }
        guard let userId = deps.auth.currentUserId else { return }

        stopDictation()
        autosaveCancellable = nil
        let job = EntryProcessingJob(
            draftId: draftId,
            userId: userId,
            promptText: promptText,
            attachments: attachments,
            text: text,
            createdAt: resumedCreatedAt ?? Date()
        )
        deps.entryProcessor.enqueue(job)
        deps.drafts.delete(draftId)   // entry is now durable via Firestore + UploadJournal
        didSave = true
    }
}
