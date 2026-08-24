import Foundation

/// The confirmation a user must clear before an attached recording is deleted.
/// Recordings are the one attachment kind with no second copy anywhere: a photo
/// usually still lives in the camera roll, a voice memo does not. Keeping the
/// copy in one small value type keeps it testable and out of the view body.
enum RecordingDeletionPrompt: Identifiable {
    case audio
    case video

    var id: String {
        switch self {
        case .audio: return "audio"
        case .video: return "video"
        }
    }

    var title: String {
        switch self {
        case .audio: return "Delete this recording?"
        case .video: return "Delete this video?"
        }
    }

    var message: String {
        switch self {
        case .audio:
            return "Your voice recording will be permanently deleted. This can't be undone."
        case .video:
            return "Your video will be permanently deleted. This can't be undone."
        }
    }
}
