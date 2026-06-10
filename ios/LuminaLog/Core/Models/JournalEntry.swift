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

    init(
        s3Key: String,
        kind: MediaKind,
        durationSec: Double? = nil,
        width: Int? = nil,
        height: Int? = nil
    ) {
        self.s3Key = s3Key
        self.kind = kind
        self.durationSec = durationSec
        self.width = width
        self.height = height
    }
}

/// State of on-device speech-to-text for voice/video entries.
enum TranscriptStatus: String, Codable, Sendable {
    case ready
    case processing
    case failed
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
    var media: [MediaItem]
    var transcriptStatus: TranscriptStatus?
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
        media: [MediaItem] = [],
        transcriptStatus: TranscriptStatus? = nil,
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
        self.media = media
        self.transcriptStatus = transcriptStatus
        self.summary = summary
        self.insights = insights
        self.prompts = prompts
        self.vector = vector
        self.wordCount = wordCount
    }
}
