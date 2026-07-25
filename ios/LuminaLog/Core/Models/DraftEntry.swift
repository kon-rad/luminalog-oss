import Foundation

/// One attachment of a draft. Stores a *relative* filename (not an absolute
/// URL): the app's sandbox container path can change across launches/restores,
/// so the absolute path is recomputed at runtime from the draft's media dir.
struct DraftAttachment: Codable, Equatable {
    enum Kind: String, Codable { case photo, video, audio }

    let id: UUID
    let kind: Kind
    /// Filename within the draft's media directory, e.g. "<uuid>.jpg".
    let fileName: String
    var durationSec: Double?
    var pixelWidth: Int?
    var pixelHeight: Int?
    /// Display/persist order (photos keep their selection order).
    var order: Int
}

/// Manifest of an in-progress multi-segment voice recording attached to a draft.
/// While `isFinalized == false`, the segments have not yet been merged into a
/// single clip — the launch recovery sweep repairs these into a normal audio
/// attachment. Cleared (set to `nil` on the draft) once the recording is merged.
struct DraftRecording: Codable, Equatable {
    /// Ordered segment filenames within the draft's media dir (each a `.caf`,
    /// possibly a merged `.m4a` as segment 0 after a resume-from-recovery).
    var segmentFileNames: [String]
    /// False while capturing or after a crash; true only once merged.
    var isFinalized: Bool
}

/// A locally-persisted in-progress journal entry. Lives only between the start
/// of composition and the moment the user taps Save (after which the entry is
/// durable via Firestore + the upload journal). Recovered onto the Home screen.
struct DraftEntry: Codable, Equatable {
    let draftId: String
    var text: String
    var promptText: String?
    var createdAtEpoch: Double
    var updatedAtEpoch: Double
    var attachments: [DraftAttachment]
    /// In-progress voice recording manifest (nil for text/photo/finished drafts).
    var recording: DraftRecording?

    var createdAt: Date { Date(timeIntervalSince1970: createdAtEpoch) }
    var updatedAt: Date { Date(timeIntervalSince1970: updatedAtEpoch) }

    /// True when the draft has nothing worth keeping (used to prune empties).
    var isEmpty: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && attachments.isEmpty
    }
}
