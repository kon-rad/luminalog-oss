import Foundation
import OSLog

/// Durable local store of in-progress drafts. One JSON file per draft under
/// `Application Support/Drafts/`, with attachment bytes under
/// `Drafts/media/<draftId>/`. Mirrors `UploadJournal`'s atomic-write + id
/// sanitization approach. `@MainActor` (all access is from the Create flow and
/// Home, both on main); `@Published drafts` lets Home react to changes.
@MainActor
final class DraftStore: ObservableObject {

    /// Current drafts, newest (by `updatedAt`) first.
    @Published private(set) var drafts: [DraftEntry] = []

    private let directory: URL
    private let fm = FileManager.default
    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "drafts")

    /// Production location: Application Support/Drafts.
    nonisolated static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("Drafts", isDirectory: true)
    }

    init(directory: URL = DraftStore.defaultDirectory()) {
        self.directory = directory
        try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
        var d = directory
        var rv = URLResourceValues()
        rv.isExcludedFromBackup = true
        try? d.setResourceValues(rv)
        reload()
    }

    // MARK: Paths (sanitized)

    /// `nil` for empty/unsafe ids (path traversal guard) — callers become no-ops.
    private func jsonURL(_ id: String) -> URL? {
        guard isSafe(id) else { return nil }
        return directory.appendingPathComponent("\(id).json")
    }

    func mediaDirectory(for id: String) -> URL? {
        guard isSafe(id) else { return nil }
        return directory.appendingPathComponent("media", isDirectory: true)
            .appendingPathComponent(id, isDirectory: true)
    }

    /// Root of the per-draft media directories (`Drafts/media/`). Exposed for
    /// the recovery scanner's orphan walk.
    var mediaRoot: URL {
        directory.appendingPathComponent("media", isDirectory: true)
    }

    /// File extensions that count as an irreplaceable recording. Photos are
    /// deliberately excluded: they usually still exist in the camera roll, and a
    /// leftover thumbnail must not pin an empty draft on disk forever.
    static let recordingExtensions: Set<String> = ["m4a", "caf", "mov", "mp4"]

    private func isSafe(_ id: String) -> Bool {
        guard !id.isEmpty, !id.contains("/"), !id.contains("\\"), !id.contains("..") else {
            Self.logger.error("Rejected unsafe draftId: \(id, privacy: .public)")
            return false
        }
        return true
    }

    // MARK: CRUD

    func upsert(_ draft: DraftEntry) {
        guard let url = jsonURL(draft.draftId) else { return }
        guard let data = try? JSONEncoder().encode(draft) else { return }
        try? data.write(to: url, options: .atomic)
        reload()
    }

    func load(_ id: String) -> DraftEntry? {
        guard let url = jsonURL(id), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(DraftEntry.self, from: data)
    }

    func all() -> [DraftEntry] {
        let files = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(DraftEntry.self, from: Data(contentsOf: $0)) }
            .sorted { $0.updatedAtEpoch > $1.updatedAtEpoch }
    }

    func delete(_ id: String) {
        if let url = jsonURL(id) { try? fm.removeItem(at: url) }
        if let mediaDir = mediaDirectory(for: id) { try? fm.removeItem(at: mediaDir) }
        reload()
    }

    /// Auto-prune entry point: deletes the draft ONLY when it holds no recording
    /// and no recording file remains in its media dir. Explicit, user-confirmed
    /// deletes go through `delete(_:)` instead.
    ///
    /// The on-disk check is deliberately independent of the JSON: a torn write
    /// that lost the attachment array must not make a recording disposable.
    func pruneIfDisposable(_ id: String) {
        if let draft = load(id), draft.holdsRecording { return }
        if hasRecordingFilesOnDisk(id) { return }
        delete(id)
    }

    /// True when the draft's media dir still contains an audio or video file.
    func hasRecordingFilesOnDisk(_ id: String) -> Bool {
        guard let dir = mediaDirectory(for: id) else { return false }
        let files = (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        return files.contains { Self.recordingExtensions.contains($0.pathExtension.lowercased()) }
    }

    // MARK: Media

    /// Writes raw bytes (e.g. a photo's in-memory data) into the draft's media
    /// dir and returns the destination URL.
    @discardableResult
    func saveMedia(draftId: String, fileName: String, data: Data) throws -> URL {
        let dest = try ensureMediaDir(draftId).appendingPathComponent(fileName)
        try data.write(to: dest, options: .atomic)
        return dest
    }

    /// Copies a file (e.g. a recorded audio / picked video temp file) into the
    /// draft's media dir and returns the destination URL.
    @discardableResult
    func importMedia(draftId: String, fileName: String, from sourceURL: URL) throws -> URL {
        let dest = try ensureMediaDir(draftId).appendingPathComponent(fileName)
        try? fm.removeItem(at: dest)
        try fm.copyItem(at: sourceURL, to: dest)
        return dest
    }

    /// Resolves the on-disk URL of a stored attachment, if it still exists.
    func mediaURL(draftId: String, fileName: String) -> URL? {
        guard let dir = mediaDirectory(for: draftId) else { return nil }
        let url = dir.appendingPathComponent(fileName)
        return fm.fileExists(atPath: url.path) ? url : nil
    }

    /// Deletes every file in the draft's media dir whose name begins with
    /// `attachmentId`, which is the naming convention `persistDraftNow` uses
    /// (`<uuid>.jpg` / `<uuid>.m4a` / `<uuid>.<videoExt>`). Matching on the id
    /// rather than a reconstructed filename keeps this correct whatever
    /// extension the source video happened to carry.
    ///
    /// Only an explicit, user-confirmed delete calls this. Every other removal
    /// path leaves the durable copy on disk on purpose, where the recovery
    /// scanner surfaces it as orphaned.
    func removeMedia(draftId: String, attachmentId: UUID) {
        guard let dir = mediaDirectory(for: draftId) else { return }
        let prefix = attachmentId.uuidString
        let files = (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        for url in files where url.lastPathComponent.hasPrefix(prefix) {
            try? fm.removeItem(at: url)
        }
    }

    func reload() {
        drafts = all()
    }

    private func ensureMediaDir(_ id: String) throws -> URL {
        guard let dir = mediaDirectory(for: id) else {
            throw CocoaError(.fileWriteInvalidFileName)
        }
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    // MARK: In-progress recording

    /// URL for segment `index` inside the draft's media dir (`rec-<index>.caf`),
    /// ensuring the dir exists. `nil` for an unsafe id or if the dir can't be made.
    func recordingSegmentURL(draftId: String, index: Int) -> URL? {
        guard let dir = try? ensureMediaDir(draftId) else { return nil }
        return dir.appendingPathComponent("rec-\(index).caf")
    }

    /// Read-modify-write of only the draft's `recording` field, preserving text
    /// and attachments written by the Create view model. Creates a minimal draft
    /// if none exists yet (recording started before any text was typed).
    func updateRecording(draftId: String, _ recording: DraftRecording?) {
        guard isSafe(draftId) else { return }
        let now = Date().timeIntervalSince1970
        var draft = load(draftId) ?? DraftEntry(
            draftId: draftId, text: "", promptText: nil,
            createdAtEpoch: now, updatedAtEpoch: now, attachments: []
        )
        draft.recording = recording
        draft.updatedAtEpoch = now
        upsert(draft)
    }

    /// Launch recovery: for every draft holding a non-finalized recording
    /// manifest (a crash or a sheet-dismiss-mid-recording left segments on disk),
    /// merge its segments into a single `.m4a` in the media dir, register that as
    /// a normal audio `DraftAttachment`, and clear the manifest, so Home renders
    /// it as an ordinary voice draft.
    ///
    /// A FAILED merge changes nothing on disk: the segments and the manifest both
    /// survive, because they are the only copy of that audio. The next sweep
    /// retries them, and `RecordingInventory` lists them as needing repair.
    func recoverDanglingRecordings(using merger: RecordingMerging) async {
        for draft in all() {
            guard let manifest = draft.recording, manifest.isFinalized == false else { continue }
            let segURLs = manifest.segmentFileNames.compactMap {
                mediaURL(draftId: draft.draftId, fileName: $0)
            }
            let mergedName = "\(UUID().uuidString).m4a"
            guard let mediaDir = mediaDirectory(for: draft.draftId) else { continue }
            let mergedURL = mediaDir.appendingPathComponent(mergedName)

            var repaired = draft
            // `&&` takes an autoclosure, which cannot be async, so the merge is
            // awaited on its own line rather than folded into the condition.
            var merged = false
            if !segURLs.isEmpty {
                merged = (try? await merger.merge(segURLs, to: mergedURL)) != nil
            }

            if merged {
                let duration = await merger.duration(of: mergedURL)
                let nextOrder = (draft.attachments.map(\.order).max() ?? -1) + 1
                repaired.attachments.append(DraftAttachment(
                    id: UUID(), kind: .audio, fileName: mergedName,
                    durationSec: duration, pixelWidth: nil, pixelHeight: nil, order: nextOrder
                ))
                // Only now are the segments redundant: their audio lives in the
                // merged clip.
                for name in manifest.segmentFileNames {
                    if let u = mediaURL(draftId: draft.draftId, fileName: name) {
                        try? fm.removeItem(at: u)
                    }
                }
                repaired.recording = nil
            } else {
                // The merge failed, so the segments are still the ONLY copy of
                // this audio. Keep both them and the manifest: the next sweep
                // retries (a transient failure heals itself), and until then the
                // recovery screen lists the draft as needing repair. Dropping
                // either here would silently destroy the recording.
                try? fm.removeItem(at: mergedURL)   // discard any partial export
            }
            upsert(repaired)
            // Auto-prune, never a hard delete: a draft whose merge failed still
            // has its segments on disk and must survive this sweep.
            pruneIfDisposable(draft.draftId)
        }
    }
}
