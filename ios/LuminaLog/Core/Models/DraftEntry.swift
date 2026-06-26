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

    var createdAt: Date { Date(timeIntervalSince1970: createdAtEpoch) }
    var updatedAt: Date { Date(timeIntervalSince1970: updatedAtEpoch) }

    /// True when the draft has nothing worth keeping (used to prune empties).
    var isEmpty: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && attachments.isEmpty
    }
}
