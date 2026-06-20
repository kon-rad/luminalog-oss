import Foundation

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
/// Locking note: `mutate` deliberately does NOT hold the lock across its
/// read-modify-write — it calls `entry(...)` then `upsert(...)`, each of which
/// takes the (non-recursive) `NSLock` independently. This app has a single
/// upload coordinator, so the lack of an atomic mutate is acceptable and it
/// avoids any chance of re-entrant deadlock.
final class UploadJournal {

    private let directory: URL
    private let lock = NSLock()
    private let fm = FileManager.default

    init(directory: URL) {
        self.directory = directory
        try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
        var d = directory
        var rv = URLResourceValues()
        rv.isExcludedFromBackup = true
        try? d.setResourceValues(rv)
    }

    /// Default production location: Application Support/Uploads.
    static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Uploads", isDirectory: true)
    }

    private func fileURL(_ draftId: String) -> URL {
        directory.appendingPathComponent("\(draftId).json")
    }

    func upsert(_ entry: PendingEntry) throws {
        lock.lock(); defer { lock.unlock() }
        let dest = fileURL(entry.draftId)
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

    func entry(draftId: String) -> PendingEntry? {
        lock.lock(); defer { lock.unlock() }
        guard let data = try? Data(contentsOf: fileURL(draftId)) else { return nil }
        return try? JSONDecoder().decode(PendingEntry.self, from: data)
    }

    func allPending() -> [PendingEntry] {
        lock.lock(); defer { lock.unlock() }
        let files = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }
            .compactMap { try? Data(contentsOf: $0) }
            .compactMap { try? JSONDecoder().decode(PendingEntry.self, from: $0) }
    }

    func mutate(draftId: String, _ block: (inout PendingEntry) -> Void) throws {
        guard var e = entry(draftId: draftId) else { return }
        block(&e)
        try upsert(e)
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
        try? fm.removeItem(at: fileURL(draftId))
    }
}
