import Foundation
import OSLog

/// Drives the Settings recovery screen: lists every recording that is still only
/// on this device and performs the four rescue actions (resume, retry, recover,
/// export) plus the confirmed delete.
@MainActor
final class RecordingsRecoveryViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog",
                                       category: "recording-recovery")

    @Published private(set) var items: [RecoverableRecording] = []
    @Published private(set) var isLoading = false

    private let inventory: RecordingInventory
    private let drafts: DraftStore
    private let processor: EntryProcessor
    private let merger: RecordingMerging

    init(inventory: RecordingInventory,
         drafts: DraftStore,
         processor: EntryProcessor,
         merger: RecordingMerging = RecordingMerger()) {
        self.inventory = inventory
        self.drafts = drafts
        self.processor = processor
        self.merger = merger
    }

    /// Grouped for display. Anything the user can act on comes first.
    var sections: [(title: String, items: [RecoverableRecording])] {
        let needsAttention = items.filter {
            $0.status == .uploadFailed || $0.status == .needsRepair || $0.status == .orphaned
        }
        let unsaved = items.filter { $0.status == .unsaved }
        let uploading = items.filter { $0.status == .awaitingUpload }
        return [
            ("Needs attention", needsAttention),
            ("Unsaved", unsaved),
            ("Uploading", uploading),
        ].filter { !$0.1.isEmpty }
    }

    func refresh() async {
        isLoading = true
        items = await inventory.refresh()
        isLoading = false
    }

    /// Confirmed delete. Removes the file (or every segment) and drops the
    /// matching attachment descriptor, then prunes the draft if nothing is left.
    func delete(_ item: RecoverableRecording) async {
        let fm = FileManager.default
        let urls = item.segmentURLs.isEmpty ? [item.fileURL] : item.segmentURLs
        for url in urls { try? fm.removeItem(at: url) }

        if var draft = drafts.load(item.draftId) {
            let removedNames = Set(urls.map(\.lastPathComponent))
            draft.attachments.removeAll { removedNames.contains($0.fileName) }
            if let recording = draft.recording,
               !Set(recording.segmentFileNames).isDisjoint(with: removedNames) {
                draft.recording = nil
            }
            drafts.upsert(draft)
            drafts.pruneIfDisposable(item.draftId)
        }
        await refresh()
    }

    /// Re-runs the background save pipeline for a stuck or failed upload.
    func retryUpload(_ item: RecoverableRecording) async {
        processor.retry(draftId: item.draftId)
        await refresh()
    }

    /// Turns an orphaned file or an unmergeable segment set back into a normal
    /// draft attachment, so it appears on Home and saves through the usual path.
    func recoverIntoDraft(_ item: RecoverableRecording) async {
        switch item.status {
        case .orphaned:
            attach(fileName: item.fileURL.lastPathComponent,
                   kind: item.kind,
                   durationSec: item.durationSec,
                   to: item.draftId)
        case .needsRepair:
            await repairSegments(item)
        default:
            break
        }
        await refresh()
    }

    // MARK: Internals

    /// Merges the surviving segments into one `.m4a`, registers it, and clears
    /// the manifest. On failure the segments are left exactly as they were: a
    /// failed repair must never cost the user the raw audio.
    private func repairSegments(_ item: RecoverableRecording) async {
        guard let mediaDir = drafts.mediaDirectory(for: item.draftId) else { return }
        let mergedName = "\(UUID().uuidString).m4a"
        let mergedURL = mediaDir.appendingPathComponent(mergedName)
        do {
            try await merger.merge(item.segmentURLs, to: mergedURL)
        } catch {
            Self.logger.error("Manual repair merge failed for \(item.draftId, privacy: .public): \(String(describing: error), privacy: .public)")
            try? FileManager.default.removeItem(at: mergedURL)
            return
        }
        let duration = await merger.duration(of: mergedURL)
        attach(fileName: mergedName, kind: .audio, durationSec: duration, to: item.draftId)

        if var draft = drafts.load(item.draftId) {
            draft.recording = nil
            drafts.upsert(draft)
        }
        for url in item.segmentURLs { try? FileManager.default.removeItem(at: url) }
    }

    /// Adds a descriptor for an existing file in the draft's media dir, creating
    /// a minimal draft when the JSON was lost entirely.
    private func attach(fileName: String,
                        kind: RecoverableRecording.Kind,
                        durationSec: Double?,
                        to draftId: String) {
        let now = Date().timeIntervalSince1970
        var draft = drafts.load(draftId) ?? DraftEntry(
            draftId: draftId, text: "", promptText: nil,
            createdAtEpoch: now, updatedAtEpoch: now, attachments: []
        )
        guard !draft.attachments.contains(where: { $0.fileName == fileName }) else { return }
        let order = (draft.attachments.map(\.order).max() ?? -1) + 1
        draft.attachments.append(DraftAttachment(
            id: UUID(),
            kind: kind == .video ? .video : .audio,
            fileName: fileName,
            durationSec: durationSec,
            pixelWidth: nil,
            pixelHeight: nil,
            order: order
        ))
        // A recovered recording belongs back in the composer, not in the
        // handed-off state its lost draft may have been in.
        draft.handedOff = false
        draft.updatedAtEpoch = now
        drafts.upsert(draft)
    }
}
