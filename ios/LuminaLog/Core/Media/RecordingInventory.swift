import AVFoundation
import Foundation

/// Read-only scanner that answers one question: which recordings are still only
/// on this device? It joins the three durable sources the app already keeps
/// (`DraftStore` JSONs, `UploadJournal` records, and the media directories on
/// disk) and writes nothing, so there is no second source of truth to drift.
@MainActor
final class RecordingInventory {

    private let drafts: DraftStore
    private let uploads: UploadJournal
    private let merger: RecordingMerging
    /// How long a handed-off draft may sit with no durable upload record before
    /// it is reported as failed rather than as still uploading. Without this a
    /// job lost between hand-off and journal write would read "Uploading"
    /// forever, with no action attached to it.
    private let staleAfter: TimeInterval

    init(drafts: DraftStore,
         uploads: UploadJournal,
         merger: RecordingMerging = RecordingMerger(),
         staleAfter: TimeInterval = 600) {
        self.drafts = drafts
        self.uploads = uploads
        self.merger = merger
        self.staleAfter = staleAfter
    }

    /// Repairs first, then scans. Opening the recovery screen therefore heals
    /// any danglers before listing what is left.
    ///
    /// Order matters: `recoverDanglingRecordings` clears the manifest whether or
    /// not the merge succeeded, so the pre-sweep manifest snapshot is the only
    /// way to tell a repaired recording from one that still needs repair.
    func refresh(now: Date = Date()) async -> [RecoverableRecording] {
        let manifestsBefore = manifestSnapshot()
        await drafts.recoverDanglingRecordings(using: merger)

        var items = await scanDrafts(now: now)
        let repairs = await scanNeedsRepair(manifestsBefore: manifestsBefore)
        items.append(contentsOf: repairs)
        items.append(contentsOf: await scanOrphans(claimedByRepair: repairs))
        return items.sorted { $0.createdAt > $1.createdAt }
    }

    // MARK: Draft-derived rows

    private func scanDrafts(now: Date) async -> [RecoverableRecording] {
        var items: [RecoverableRecording] = []
        for draft in drafts.all() {
            guard let status = draftStatus(draft, now: now) else { continue }
            for attachment in draft.attachments {
                guard let kind = kind(for: attachment.kind) else { continue }
                guard let url = drafts.mediaURL(draftId: draft.draftId,
                                                fileName: attachment.fileName) else { continue }
                // `??` takes an autoclosure, which cannot be async, so this is
                // spelled out rather than folded into one expression.
                var duration = attachment.durationSec
                if duration == nil { duration = await merger.duration(of: url) }
                items.append(RecoverableRecording(
                    id: "\(draft.draftId)/\(attachment.fileName)",
                    draftId: draft.draftId,
                    kind: kind,
                    fileURL: url,
                    segmentURLs: [],
                    durationSec: duration,
                    sizeBytes: Self.fileSize(url),
                    createdAt: draft.createdAt,
                    title: Self.title(for: draft),
                    status: status
                ))
            }
        }
        return items
    }

    /// The status every recording on this draft carries, or nil when the draft
    /// has nothing left to recover (its media reached the cloud).
    private func draftStatus(_ draft: DraftEntry, now: Date) -> RecoverableRecording.Status? {
        guard !draft.attachments.isEmpty else { return nil }
        guard draft.handedOff else { return .unsaved }

        let isStale = now.timeIntervalSince(draft.updatedAt) > staleAfter
        guard let record = uploads.entry(draftId: draft.draftId) else {
            // No durable record yet: fresh means still starting up, stale means
            // the job was lost and the user needs a retry button.
            return isStale ? .uploadFailed : .awaitingUpload
        }
        if record.uploads.contains(where: { $0.state == .failed }) { return .uploadFailed }
        if record.allUploaded { return nil }
        return isStale ? .uploadFailed : .awaitingUpload
    }

    // MARK: Failed-merge rows

    /// draftId to segment filenames, captured before the repair sweep runs.
    private func manifestSnapshot() -> [String: [String]] {
        var snapshot: [String: [String]] = [:]
        for draft in drafts.all() {
            if let recording = draft.recording, recording.isFinalized == false {
                snapshot[draft.draftId] = recording.segmentFileNames
            }
        }
        return snapshot
    }

    /// One row per draft whose segments survived the sweep, meaning the merge
    /// failed. The row carries every segment so the screen can export or retry
    /// the merge rather than showing an unplayable fragment.
    private func scanNeedsRepair(manifestsBefore: [String: [String]]) async -> [RecoverableRecording] {
        var items: [RecoverableRecording] = []
        for (draftId, segmentNames) in manifestsBefore {
            let urls = segmentNames.compactMap {
                drafts.mediaURL(draftId: draftId, fileName: $0)
            }
            guard let first = urls.first else { continue }   // merged and cleaned up
            let draft = drafts.load(draftId)
            var total: TimeInterval = 0
            for url in urls { total += await merger.duration(of: url) }
            items.append(RecoverableRecording(
                id: "\(draftId)/\(first.lastPathComponent)",
                draftId: draftId,
                kind: .audio,
                fileURL: first,
                segmentURLs: urls,
                durationSec: total > 0 ? total : nil,
                sizeBytes: urls.reduce(0) { $0 + Self.fileSize($1) },
                createdAt: draft?.createdAt ?? Date(timeIntervalSince1970: 0),
                title: draft.map(Self.title(for:)) ?? first.lastPathComponent,
                status: .needsRepair
            ))
        }
        return items
    }

    // MARK: Orphan rows

    /// Walks `Drafts/media/*/` for recording files nothing claims: a draft whose
    /// JSON was lost or torn, or a recording a priority rule displaced. This is
    /// the layer that finds what the JSON cannot describe.
    private func scanOrphans(claimedByRepair repairs: [RecoverableRecording]) async -> [RecoverableRecording] {
        let fm = FileManager.default
        let repairSegments = Set(repairs.flatMap { $0.segmentURLs.map(\.path) })
        guard let dirs = try? fm.contentsOfDirectory(
            at: drafts.mediaRoot,
            includingPropertiesForKeys: [.isDirectoryKey]
        ) else { return [] }

        var items: [RecoverableRecording] = []
        for dir in dirs {
            guard (try? dir.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
            else { continue }
            let draftId = dir.lastPathComponent
            let draft = drafts.load(draftId)
            var claimed = Set(draft?.attachments.map(\.fileName) ?? [])
            claimed.formUnion(draft?.recording?.segmentFileNames ?? [])

            let files = (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
            for url in files {
                guard DraftStore.recordingExtensions.contains(url.pathExtension.lowercased()),
                      !claimed.contains(url.lastPathComponent),
                      !repairSegments.contains(url.path)
                else { continue }
                let created = (try? url.resourceValues(forKeys: [.creationDateKey]).creationDate)
                    ?? draft?.createdAt ?? Date(timeIntervalSince1970: 0)
                items.append(RecoverableRecording(
                    id: "\(draftId)/\(url.lastPathComponent)",
                    draftId: draftId,
                    kind: Self.isVideoExtension(url.pathExtension) ? .video : .audio,
                    fileURL: url,
                    segmentURLs: [],
                    durationSec: await merger.duration(of: url),
                    sizeBytes: Self.fileSize(url),
                    createdAt: created,
                    title: created.formatted(date: .abbreviated, time: .shortened),
                    status: .orphaned
                ))
            }
        }
        return items
    }

    // MARK: Helpers

    private func kind(for kind: DraftAttachment.Kind) -> RecoverableRecording.Kind? {
        switch kind {
        case .audio: return .audio
        case .video: return .video
        case .photo: return nil
        }
    }

    private static func isVideoExtension(_ ext: String) -> Bool {
        ["mov", "mp4"].contains(ext.lowercased())
    }

    private static func title(for draft: DraftEntry) -> String {
        let trimmed = draft.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return draft.createdAt.formatted(date: .abbreviated, time: .shortened)
        }
        return String(trimmed.prefix(60))
    }

    static func fileSize(_ url: URL) -> Int {
        (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    }
}
