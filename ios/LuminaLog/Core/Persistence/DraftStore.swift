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
    /// a normal audio `DraftAttachment`, and clear the manifest — so Home renders
    /// it as an ordinary voice draft.
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
            if !segURLs.isEmpty, (try? await merger.merge(segURLs, to: mergedURL)) != nil {
                let duration = await merger.duration(of: mergedURL)
                let nextOrder = (draft.attachments.map(\.order).max() ?? -1) + 1
                repaired.attachments.append(DraftAttachment(
                    id: UUID(), kind: .audio, fileName: mergedName,
                    durationSec: duration, pixelWidth: nil, pixelHeight: nil, order: nextOrder
                ))
            }
            // Delete now-merged segment files; drop the manifest either way.
            for name in manifest.segmentFileNames {
                if let u = mediaURL(draftId: draft.draftId, fileName: name) {
                    try? fm.removeItem(at: u)
                }
            }
            repaired.recording = nil
            if repaired.isEmpty {
                delete(draft.draftId)
            } else {
                upsert(repaired)
            }
        }
    }
}
