import Foundation
import UIKit

/// Rebuilds an `AttachmentSet` from a durable `DraftEntry` and its `DraftStore`
/// media directory. Shared by the compose "resume draft" flow
/// (`CreateEntryViewModel.loadResumedDraftIfNeeded`) and the `EntryProcessor`
/// retry-rebuild, so the two paths never drift.
///
/// Audio/video are copied to fresh temp files (never referenced in place) so the
/// pipeline's "attachments reference temp files" invariant holds and its cleanup
/// (`EntryProcessor.finish(cleanup:)`) never deletes the durable draft media.
/// Photos are loaded as in-memory data.
@MainActor
enum DraftMediaHydrator {

    /// Materializes the draft's attachments. Returns the rebuilt set plus the
    /// descriptor ids that were successfully hydrated (so the compose VM can keep
    /// its `persistedAttachmentIDs` bookkeeping intact).
    static func hydrate(draft: DraftEntry, store: DraftStore)
        -> (attachments: AttachmentSet, hydratedDescriptorIds: Set<UUID>) {
        var attachments = AttachmentSet()
        var hydrated: Set<UUID> = []
        var photos: [PhotoAttachment] = []

        for desc in draft.attachments.sorted(by: { $0.order < $1.order }) {
            guard let durable = store.mediaURL(draftId: draft.draftId, fileName: desc.fileName) else { continue }
            switch desc.kind {
            case .photo:
                if let data = try? Data(contentsOf: durable) {
                    photos.append(PhotoAttachment(imageData: data,
                                                  thumbnail: UIImage(data: data),
                                                  pixelWidth: desc.pixelWidth,
                                                  pixelHeight: desc.pixelHeight))
                    hydrated.insert(desc.id)
                }
            case .audio:
                if let temp = try? copyToTemp(durable, ext: "m4a") {
                    _ = attachments.setAudio(AudioAttachment(url: temp, durationSec: desc.durationSec ?? 0))
                    hydrated.insert(desc.id)
                }
            case .video:
                if let temp = try? copyToTemp(durable, ext: durable.pathExtension) {
                    attachments.setVideo(VideoAttachment(url: temp, thumbnail: nil, durationSec: desc.durationSec))
                    hydrated.insert(desc.id)
                }
            }
        }
        if !photos.isEmpty { _ = attachments.addPhotos(photos) }
        return (attachments, hydrated)
    }

    private static func copyToTemp(_ source: URL, ext: String) throws -> URL {
        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).\(ext.isEmpty ? "dat" : ext)")
        try? FileManager.default.removeItem(at: dest)
        try FileManager.default.copyItem(at: source, to: dest)
        return dest
    }
}
