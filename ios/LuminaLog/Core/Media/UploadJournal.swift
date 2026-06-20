import Foundation
import OSLog

enum PendingUploadState: String, Codable { case pending, uploading, uploaded, failed }

/// One attachment to upload (encrypted ciphertext already staged on disk).
struct PendingUpload: Codable, Equatable {
    let attachmentId: UUID
    let kind: MediaKind
    let journalId: String               // the draftId, so presign can pass it
    var s3Key: String
    var encryptedPath: String           // ciphertext temp file
    var durationSec: Double?
    var width: Int?
    var height: Int?
    var thumbnailS3Key: String?
    var state: PendingUploadState = .pending
    var attemptCount: Int = 0
    var nextEarliestAttemptEpoch: Double = 0

    var encryptedURL: URL { URL(fileURLWithPath: encryptedPath) }

    func mediaItem() -> MediaItem {
        var item = MediaItem(s3Key: s3Key, kind: kind, thumbnailS3Key: thumbnailS3Key)
        item.durationSec = durationSec
        item.width = width
        item.height = height
        return item
    }
}

/// The full entry skeleton + its expected uploads. Persisted so the entry can
/// be finalized from the background-session delegate even after a relaunch.
struct PendingEntry: Codable, Equatable {
    let draftId: String
    let userId: String
    let type: JournalType
    var title: String
    var content: String
    var wordCount: Int
    var transcriptStatus: TranscriptStatus?
    let createdAtEpoch: Double
    let promptText: String?
    var uploads: [PendingUpload]

    var createdAt: Date { Date(timeIntervalSince1970: createdAtEpoch) }
    var allUploaded: Bool { uploads.allSatisfy { $0.state == .uploaded } }
    var mediaItems: [MediaItem] { uploads.map { $0.mediaItem() } }
}

/// Durable store of in-flight uploads. One JSON file per entry under a journal
/// directory in Application Support (excluded from iCloud backup). Synchronous,
/// atomic writes (write-temp + replace). Thread-safe via an internal lock.
///
/// Concurrency: a background-URLSession delegate mutates this store off the
/// main thread, so correctness requires that read-modify-write be atomic.
/// `mutate` (and `markUploaded`, which routes through it) holds the lock
/// across the entire read-modify-write so two concurrent mutations cannot
/// interleave and lose an update. All public methods take the (non-recursive)
/// `NSLock` and delegate to private *unlocked* cores (`_read`/`_write`); a
/// locked public method never calls another locked public method, so there is
/// no re-entrant deadlock.
final class UploadJournal {

    private let directory: URL
    private let lock = NSLock()
    private let fm = FileManager.default
    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "uploadJournal")

    init(directory: URL) {
        self.directory = directory
        try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
        var d = directory
        var rv = URLResourceValues()
        rv.isExcludedFromBackup = true
        try? d.setResourceValues(rv)
        sweepStaleTempFiles()
    }

    /// Default production location: Application Support/Uploads.
    static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Uploads", isDirectory: true)
    }

    /// Builds the on-disk URL for a draft's JSON file.
    ///
    /// `draftId` is sanitized to prevent path traversal: path separators
    /// (`/`, `\`) and `..` sequences must not let a record escape `directory`.
    /// We return `nil` (rather than throwing/crashing) for an empty or unsafe
    /// id so the calling op becomes a safe no-op in release builds.
    private func fileURL(_ draftId: String) -> URL? {
        guard !draftId.isEmpty,
              !draftId.contains("/"),
              !draftId.contains("\\"),
              !draftId.contains("..") else {
            Self.logger.error("Rejected unsafe draftId for fileURL: \(draftId, privacy: .public)")
            return nil
        }
        return directory.appendingPathComponent("\(draftId).json")
    }

    /// Remove leftover `*.tmp` files orphaned by a crash between temp-write and
    /// replace, so they don't accumulate.
    private func sweepStaleTempFiles() {
        let files = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        for url in files where url.pathExtension == "tmp" {
            try? fm.removeItem(at: url)
        }
    }

    /// Quarantine an undecodable file by renaming it to `<name>.corrupt` so it
    /// stops being re-scanned by `allPending()`/`entry()`.
    private func quarantine(_ url: URL, error: Error) {
        Self.logger.error("Quarantining undecodable upload record \(url.lastPathComponent, privacy: .public): \(String(describing: error), privacy: .public)")
        let dest = url.appendingPathExtension("corrupt")
        try? fm.removeItem(at: dest)            // clear any prior quarantine of the same name
        try? fm.moveItem(at: url, to: dest)
    }

    // MARK: - Unlocked cores (callers MUST hold `lock`)

    /// Read + decode a single record. Quarantines and returns nil on decode
    /// failure. Caller must hold `lock`.
    private func _read(_ draftId: String) -> PendingEntry? {
        guard let url = fileURL(draftId) else { return nil }
        guard let data = try? Data(contentsOf: url) else { return nil }
        do {
            return try JSONDecoder().decode(PendingEntry.self, from: data)
        } catch {
            quarantine(url, error: error)
            return nil
        }
    }

    /// Atomically (temp + replace) persist a record. Caller must hold `lock`.
    private func _write(_ entry: PendingEntry) throws {
        guard let dest = fileURL(entry.draftId) else { return }   // unsafe id: safe no-op
        let data = try JSONEncoder().encode(entry)

        if fm.fileExists(atPath: dest.path) {
            // Overwrite existing record atomically via temp + replace.
            let tmp = dest.appendingPathExtension("tmp")
            try data.write(to: tmp, options: .atomic)
            do {
                _ = try fm.replaceItemAt(dest, withItemAt: tmp)
            } catch {
                // Fall back to a direct atomic write if replace fails; clean up tmp.
                try? fm.removeItem(at: tmp)
                try data.write(to: dest, options: .atomic)
            }
        } else {
            // No existing file: a plain atomic write creates it.
            try data.write(to: dest, options: .atomic)
        }
    }

    // MARK: - Public, locked API

    func upsert(_ entry: PendingEntry) throws {
        lock.lock(); defer { lock.unlock() }
        try _write(entry)
    }

    func entry(draftId: String) -> PendingEntry? {
        lock.lock(); defer { lock.unlock() }
        return _read(draftId)
    }

    func allPending() -> [PendingEntry] {
        lock.lock(); defer { lock.unlock() }
        let files = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        // Only scan `.json` (excludes `.corrupt` and `.tmp`).
        return files.filter { $0.pathExtension == "json" }
            .compactMap { url -> PendingEntry? in
                guard let data = try? Data(contentsOf: url) else { return nil }
                do {
                    return try JSONDecoder().decode(PendingEntry.self, from: data)
                } catch {
                    quarantine(url, error: error)
                    return nil
                }
            }
    }

    /// Atomic read-modify-write: the lock is held once across both the read and
    /// the write, so concurrent mutations cannot interleave and lose updates.
    func mutate(draftId: String, _ block: (inout PendingEntry) -> Void) throws {
        lock.lock(); defer { lock.unlock() }
        guard var e = _read(draftId) else { return }
        block(&e)
        try _write(e)
    }

    func markUploaded(draftId: String, attachmentId: UUID, s3Key: String) throws {
        try mutate(draftId: draftId) { e in
            if let i = e.uploads.firstIndex(where: { $0.attachmentId == attachmentId }) {
                e.uploads[i].state = .uploaded
                e.uploads[i].s3Key = s3Key
            }
        }
    }

    func remove(draftId: String) {
        lock.lock(); defer { lock.unlock() }
        guard let url = fileURL(draftId) else { return }
        try? fm.removeItem(at: url)
    }
}
