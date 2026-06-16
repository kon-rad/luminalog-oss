import Foundation
import OSLog

/// Drives the transcript editor sheet (image entries): edit text, record voice
/// memos that are transcribed by the backend and appended to the text, and save
/// — uploading the recorded clips to S3 and persisting the edited content.
@MainActor
final class TranscriptEditorViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "transcript-editor")

    /// A recorded-but-not-yet-uploaded voice memo.
    struct PendingClip: Identifiable, Equatable {
        let id: UUID
        let url: URL
        let durationSec: Double
        var transcribeFailed: Bool = false
    }

    @Published var text: String
    @Published private(set) var pendingClips: [PendingClip] = []
    @Published private(set) var transcribeState: AIActionState = .idle
    @Published private(set) var saveState: AIActionState = .idle
    /// Set true when the sheet should dismiss (successful save, or the entry was
    /// deleted out from under us).
    @Published private(set) var didSave = false
    @Published var errorMessage: String?

    let entryId: String
    private let journals: JournalRepository
    private let ai: AIService
    private let media: MediaUploader

    init(
        entryId: String,
        initialText: String,
        journals: JournalRepository,
        ai: AIService,
        media: MediaUploader
    ) {
        self.entryId = entryId
        self.text = initialText
        self.journals = journals
        self.ai = ai
        self.media = media
    }

    // MARK: - Recording → transcription

    /// Stage a freshly recorded clip and transcribe it (text appended to the editor).
    func addRecordedClip(_ attachment: AudioAttachment) async {
        pendingClips.append(
            PendingClip(id: attachment.id, url: attachment.url, durationSec: attachment.durationSec)
        )
        await transcribe(clipID: attachment.id)
    }

    /// (Re)transcribe a staged clip and append its text to the editor.
    func transcribe(clipID: UUID) async {
        guard let clip = pendingClips.first(where: { $0.id == clipID }) else { return }
        transcribeState = .loading
        do {
            let data = try Data(contentsOf: clip.url)
            let result = try await ai.transcribeClip(audio: data, contentType: "audio/m4a")
            let trimmed = result.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                text = [text.trimmingCharacters(in: .whitespacesAndNewlines), trimmed]
                    .filter { !$0.isEmpty }
                    .joined(separator: "\n\n")
            }
            setFailed(false, for: clipID)
            transcribeState = .idle
        } catch {
            Self.logger.error("transcribeClip failed: \(error.localizedDescription, privacy: .public)")
            setFailed(true, for: clipID)
            transcribeState = .failed
        }
    }

    private func setFailed(_ failed: Bool, for clipID: UUID) {
        guard let i = pendingClips.firstIndex(where: { $0.id == clipID }) else { return }
        pendingClips[i].transcribeFailed = failed
    }

    // MARK: - Editing

    func clear() { text = "" }

    // MARK: - Save

    func save() async {
        guard saveState != .loading else { return }
        saveState = .loading
        errorMessage = nil
        do {
            var uploaded: [MediaItem] = []
            for clip in pendingClips {
                var item = try await media.upload(fileURL: clip.url, kind: .audio, journalId: entryId)
                item.durationSec = clip.durationSec
                uploaded.append(item)
            }
            try await journals.updateContent(
                id: entryId,
                content: text,
                contentEditedAt: Date(),
                appendedMedia: uploaded
            )
            await ai.requestIndex(journalId: entryId)
            saveState = .idle
            didSave = true
        } catch JournalRepositoryError.entryNotFound {
            errorMessage = "This entry is no longer available."
            saveState = .failed
            didSave = true
        } catch {
            Self.logger.error("save failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Couldn't save your changes. Please try again."
            saveState = .failed
        }
    }
}
