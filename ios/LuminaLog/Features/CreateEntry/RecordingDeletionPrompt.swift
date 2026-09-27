import Foundation

/// The confirmation a user must clear before an attached recording is deleted.
/// Recordings are the one attachment kind with no second copy anywhere: a photo
/// usually still lives in the camera roll, a voice memo does not. Keeping the
/// copy in one small value type keeps it testable and out of the view body.
enum RecordingDeletionPrompt: Identifiable, Equatable {
    /// One voice recording. `id` is the attachment to delete; nil targets the
    /// instant chip of a recording whose merge is still running.
    case audio(id: UUID?)
    case video
    /// Discarding a whole draft that still holds recordings: a second, explicit
    /// confirmation on top of the close dialog's Discard button.
    case discardDraft(recordingCount: Int)

    var id: String {
        switch self {
        case .audio(let id): return "audio-\(id?.uuidString ?? "pending")"
        case .video: return "video"
        case .discardDraft: return "discard"
        }
    }

    var title: String {
        switch self {
        case .audio: return "Delete this recording?"
        case .video: return "Delete this video?"
        case .discardDraft: return "Delete your recordings?"
        }
    }

    var message: String {
        switch self {
        case .audio:
            return "Your voice recording will be permanently deleted. This can't be undone."
        case .video:
            return "Your video will be permanently deleted. This can't be undone."
        case .discardDraft(let count):
            let recordings = count == 1 ? "1 voice recording" : "\(count) voice recordings"
            return "Discarding this entry permanently deletes \(recordings). This can't be undone."
        }
    }

    var confirmLabel: String {
        switch self {
        case .discardDraft: return "Delete Forever"
        case .audio, .video: return "Delete"
        }
    }
}
