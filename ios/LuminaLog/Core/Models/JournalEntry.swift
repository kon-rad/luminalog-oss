import Foundation

// Pure domain models — no Firebase imports in Core/Models.
// Firestore mapping lives in Core/Persistence; see §3 of the architecture spec
// for the canonical field list these mirror.

/// The four journal entry types.
enum JournalType: String, Codable, CaseIterable, Sendable {
    case text
    case voice
    case video
    case image
}

/// Kind of a media attachment stored in S3.
enum MediaKind: String, Codable, CaseIterable, Sendable {
    case image
    case video
    case audio
}

/// A single media attachment on a journal entry.
struct MediaItem: Codable, Equatable, Sendable {
    var s3Key: String
    var kind: MediaKind
    var durationSec: Double?
    var width: Int?
    var height: Int?
    /// S3 key of the 200 px thumbnail; present on image attachments uploaded
    /// after thumbnail generation was introduced.
    var thumbnailS3Key: String?

    init(
        s3Key: String,
        kind: MediaKind,
        durationSec: Double? = nil,
        width: Int? = nil,
        height: Int? = nil,
        thumbnailS3Key: String? = nil
    ) {
        self.s3Key = s3Key
        self.kind = kind
        self.durationSec = durationSec
        self.width = width
        self.height = height
        self.thumbnailS3Key = thumbnailS3Key
    }
}

/// State of on-device speech-to-text for voice/video entries.
enum TranscriptStatus: String, Codable, Sendable {
    case ready
    case processing
    case failed
}

/// Background save-pipeline state for an entry whose media is uploaded and
/// transcribed after the Create screen is dismissed (audio/image/video).
/// `nil` means the entry is fully settled (legacy entries, or pure text).
enum ProcessingStatus: String, Codable, Sendable {
    case processing     // initial write / deriving content (image OCR)
    case uploading      // media upload in flight
    case saving         // writing final content + media to Firestore
    case transcribing   // handed off to server-side Whisper (voice/video)
    case ready          // pipeline complete
    case failed         // a step failed; retry available in-session
}

/// A timestamped record of a user edit to an entry's title/content.
/// `fields` is a subset of ["title", "content"] — what changed in that edit.
struct EditRecord: Codable, Equatable, Sendable {
    var editedAt: Date
    var fields: [String]

    init(editedAt: Date = Date(), fields: [String]) {
        self.editedAt = editedAt
        self.fields = fields
    }
}

/// AI-generated journaling prompts attached to an entry.
struct AIPrompts: Codable, Equatable, Sendable {
    var items: [String]
    var generatedAt: Date
    var model: String

    init(items: [String], generatedAt: Date = Date(), model: String = "") {
        self.items = items
        self.generatedAt = generatedAt
        self.model = model
    }
}

/// RAG indexing state for an entry (`vector` field in Firestore).
struct VectorState: Codable, Equatable, Sendable {

    enum Status: String, Codable, Sendable {
        case indexed
        case pending
        case failed
    }

    var status: Status
    var chunkCount: Int
    var indexedAt: Date?

    init(status: Status = .pending, chunkCount: Int = 0, indexedAt: Date? = nil) {
        self.status = status
        self.chunkCount = chunkCount
        self.indexedAt = indexedAt
    }
}

/// A journal entry — `journals/{journalId}` in Firestore.
struct JournalEntry: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var userId: String
    var type: JournalType
    var title: String
    var createdAt: Date
    var updatedAt: Date
    /// Canonical text: typed body, voice/video transcript, or image OCR text.
    var content: String
    /// Set when the user edits the canonical text (flags stale summaries).
    var contentEditedAt: Date?
    /// Dated history of user edits to title/content (newest entries appended).
    var editHistory: [EditRecord]
    var media: [MediaItem]
    var transcriptStatus: TranscriptStatus?
    /// Background upload/transcribe pipeline state; nil once settled.
    var processingStatus: ProcessingStatus?
    var summary: AIGeneration?
    var insights: AIGeneration?
    var prompts: AIPrompts?
    var vector: VectorState
    var wordCount: Int

    init(
        id: String = UUID().uuidString,
        userId: String,
        type: JournalType,
        title: String,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        content: String = "",
        contentEditedAt: Date? = nil,
        editHistory: [EditRecord] = [],
        media: [MediaItem] = [],
        transcriptStatus: TranscriptStatus? = nil,
        processingStatus: ProcessingStatus? = nil,
        summary: AIGeneration? = nil,
        insights: AIGeneration? = nil,
        prompts: AIPrompts? = nil,
        vector: VectorState = VectorState(),
        wordCount: Int = 0
    ) {
        self.id = id
        self.userId = userId
        self.type = type
        self.title = title
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.content = content
        self.contentEditedAt = contentEditedAt
        self.editHistory = editHistory
        self.media = media
        self.transcriptStatus = transcriptStatus
        self.processingStatus = processingStatus
        self.summary = summary
        self.insights = insights
        self.prompts = prompts
        self.vector = vector
        self.wordCount = wordCount
    }
}

// MARK: - Derived activity / status badge

extension JournalEntry {

    /// What the list/detail views show while an entry settles in the background.
    /// Combines the local `processingStatus` pipeline with the server-owned
    /// `transcriptStatus` so the transcribe phase resolves to `.idle`/`.failed`
    /// once the server finishes.
    enum ActivityState: Equatable {
        case idle
        case processing
        case uploading
        case saving
        case transcribing
        case failed
    }

    var activityState: ActivityState {
        switch processingStatus {
        case .failed:
            return .failed
        case .processing:
            return .processing
        case .uploading:
            return .uploading
        case .saving:
            return .saving
        case .transcribing:
            // Handed off to the server; resolve once it reports terminal state.
            switch transcriptStatus {
            case .failed: return .failed
            case .ready: return .idle
            case .processing, .none: return .transcribing
            }
        case .ready, .none:
            // Legacy/settled entries still surface live transcription progress.
            switch transcriptStatus {
            case .processing: return .transcribing
            case .failed: return .failed
            case .ready, .none: return .idle
            }
        }
    }

    /// Short badge label for the current activity, or nil when settled.
    var statusBadgeText: String? {
        switch activityState {
        case .idle: return nil
        case .processing: return "Processing…"
        case .uploading: return "Uploading…"
        case .saving: return "Saving…"
        case .transcribing: return "Transcribing…"
        case .failed: return "Failed"
        }
    }
}
