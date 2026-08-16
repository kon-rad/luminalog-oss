import Foundation

/// One recording that has not reached the cloud, as surfaced by
/// `RecordingInventory` and rendered by the Settings recovery screen.
struct RecoverableRecording: Identifiable, Equatable {

    enum Kind: Equatable { case audio, video }

    enum Status: Equatable {
        /// Composed locally, never handed to the save pipeline.
        case unsaved
        /// Handed off; its upload is pending or in flight.
        case awaitingUpload
        /// Handed off; an upload failed, or it has been stuck past the
        /// staleness threshold with no durable upload record.
        case uploadFailed
        /// Segments the merge sweep could not join into a single clip.
        case needsRepair
        /// A recording file on disk with no owning draft record.
        case orphaned
    }

    /// Stable across refreshes: "<draftId>/<fileName>".
    let id: String
    let draftId: String
    let kind: Kind
    /// The playable/exportable file. For `.needsRepair` this is the first
    /// segment, which is the only thing playable before a successful merge.
    let fileURL: URL
    /// Non-empty only for `.needsRepair`: the raw segments awaiting a merge.
    let segmentURLs: [URL]
    let durationSec: Double?
    let sizeBytes: Int
    let createdAt: Date
    /// Draft text prefix, else a formatted date.
    let title: String
    let status: Status
}
