import Foundation
import OSLog

/// Drives the text-only entry edit sheet: edits title + canonical content and
/// persists them with an edit-history record. Media, assets, and entry type are
/// immutable here (see spec). Re-indexes (re-embeds + re-summarizes) only when
/// the content changed; a title-only edit writes Firestore without re-indexing.
@MainActor
final class EntryEditViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "entry-edit")

    @Published var title: String
    @Published var content: String
    @Published private(set) var saveState: AIActionState = .idle
    /// Set true when the sheet should dismiss (successful save, no-op, or the
    /// entry was deleted out from under us).
    @Published private(set) var didSave = false
    @Published var errorMessage: String?

    let entry: JournalEntry
    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService

    init(entry: JournalEntry, journals: JournalRepository, profiles: ProfileRepository, ai: AIService) {
        self.entry = entry
        self.title = entry.title
        self.content = entry.content
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
    }

    /// The content label varies by entry type (spec §iOS components 3).
    var contentLabel: String {
        switch entry.type {
        case .text: return "Body"
        case .image: return "Transcribed text"
        case .voice, .video: return "Transcript"
        }
    }

    var hasMedia: Bool { !entry.media.isEmpty }

    func save() async {
        guard saveState != .loading else { return }

        let newTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let newContent = content   // preserve intentional internal whitespace
        var changed: [String] = []
        if newTitle != entry.title { changed.append("title") }
        if newContent != entry.content { changed.append("content") }

        // Nothing changed — just dismiss.
        guard !changed.isEmpty else { didSave = true; return }

        saveState = .loading
        errorMessage = nil
        let now = Date()
        let contentChanged = changed.contains("content")
        let oldWordCount = WordCount.of(entry.content)
        let newWordCount = WordCount.of(newContent)
        do {
            try await journals.applyEntryEdit(
                id: entry.id,
                title: newTitle,
                content: newContent,
                wordCount: newWordCount,
                contentEditedAt: contentChanged ? now : nil,
                edit: EditRecord(editedAt: now, fields: changed)
            )
            // Re-embed + re-summarize only when content changed. The server
            // /v1/rag/index re-purges chunks and, because contentEditedAt now
            // post-dates the summary, regenerates the summary + its embedding.
            if contentChanged {
                // Credit the word delta to the daily goal on the entry's
                // original day (best-effort, like the creation side-effect).
                if newWordCount != oldWordCount {
                    try? await profiles.recordEntrySaved(
                        wordCountDelta: newWordCount - oldWordCount,
                        on: entry.createdAt
                    )
                }
                await ai.requestIndex(journalId: entry.id)
            }
            saveState = .idle
            didSave = true
        } catch JournalRepositoryError.entryNotFound {
            errorMessage = "This entry is no longer available."
            saveState = .failed
            didSave = true
        } catch {
            Self.logger.error("entry edit save failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Couldn't save your changes. Please try again."
            saveState = .failed
        }
    }
}
