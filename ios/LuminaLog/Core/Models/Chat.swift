import Foundation

/// Whether a chat is a text conversation or a voice call.
enum ChatKind: String, Codable, CaseIterable, Sendable {
    case text
    case voice
}

/// A conversation — `chats/{chatId}` in Firestore.
struct Chat: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var userId: String
    var kind: ChatKind
    var title: String
    var createdAt: Date
    var lastMessageAt: Date
    var vapiCallId: String?
    /// Voice-call metadata, populated by the end-of-call webhook.
    var voiceStatus: String?
    var endedReason: String?
    var recordingPath: String?
    var recordingDurationSeconds: Double?
    /// S3 key of the plaintext recording staged by the webhook, awaiting on-device
    /// encryption + re-upload. Cleared by the server once `recordingPath` is set.
    var pendingRecordingKey: String?
    var rawTranscript: String?
    /// ID of the focal journal entry this chat is anchored to, if any.
    var journalId: String?
    /// Cached title of the focal entry (avoids an extra Firestore read in the history list).
    var journalTitle: String?
    /// Id of the Mirror reflection this chat is about, if any
    /// (`dailyEncouragements/{uid}/messages/{id}`). Display label lives in `journalTitle`.
    var mirrorId: String?
    /// Life Story Interview sitting: the interview this call belongs to. Every
    /// sitting of one interview shares this id (see `LifeInterview`).
    var interviewId: String?
    /// Section of the interview this sitting covers, "A" to "G".
    var interviewSection: String?
    /// The last question the sitting reached, for example "B3".
    var interviewItem: String?
    /// True once the interviewer closed the section in this sitting.
    var interviewSectionDone: Bool?

    init(
        id: String = UUID().uuidString,
        userId: String,
        kind: ChatKind = .text,
        title: String = "",
        createdAt: Date = Date(),
        lastMessageAt: Date = Date(),
        vapiCallId: String? = nil,
        voiceStatus: String? = nil,
        endedReason: String? = nil,
        recordingPath: String? = nil,
        recordingDurationSeconds: Double? = nil,
        pendingRecordingKey: String? = nil,
        rawTranscript: String? = nil,
        journalId: String? = nil,
        journalTitle: String? = nil,
        mirrorId: String? = nil,
        interviewId: String? = nil,
        interviewSection: String? = nil,
        interviewItem: String? = nil,
        interviewSectionDone: Bool? = nil
    ) {
        self.id = id
        self.userId = userId
        self.kind = kind
        self.title = title
        self.createdAt = createdAt
        self.lastMessageAt = lastMessageAt
        self.vapiCallId = vapiCallId
        self.voiceStatus = voiceStatus
        self.endedReason = endedReason
        self.recordingPath = recordingPath
        self.recordingDurationSeconds = recordingDurationSeconds
        self.pendingRecordingKey = pendingRecordingKey
        self.rawTranscript = rawTranscript
        self.journalId = journalId
        self.journalTitle = journalTitle
        self.mirrorId = mirrorId
        self.interviewId = interviewId
        self.interviewSection = interviewSection
        self.interviewItem = interviewItem
        self.interviewSectionDone = interviewSectionDone
    }
}
