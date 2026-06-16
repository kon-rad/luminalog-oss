import Foundation
import CryptoKit

/// Downloads encrypted media, decrypts it (or passes plaintext through for
/// demo-mode / pre-encryption files), and caches the plaintext on disk so the
/// image/video/audio views can read a local file URL. Lives off the main actor
/// so large-file decryption never blocks the UI.
///
/// Decrypted plaintext is cached in `Caches/media/` keyed by a hash of the
/// s3Key; `purge()` clears it on sign-out so plaintext never outlives a session.
actor MediaContentCache {

    /// Downloads a remote URL to a temp file. Injectable for tests.
    typealias Fetch = @Sendable (URL) async throws -> URL

    private let directory: URL
    private let fetch: Fetch
    private var inFlight: [String: Task<URL, Error>] = [:]

    /// Default shared cache directory (`Caches/media/`).
    static var defaultDirectory: URL {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return caches.appendingPathComponent("media", isDirectory: true)
    }

    init(
        directory: URL = MediaContentCache.defaultDirectory,
        fetch: @escaping Fetch = MediaContentCache.urlSessionFetch
    ) {
        self.directory = directory
        self.fetch = fetch
    }

    /// Default fetch: stream the remote URL to a temp file via URLSession.
    static let urlSessionFetch: Fetch = { url in
        let (tmp, _) = try await URLSession.shared.download(from: url)
        // download() deletes `tmp` when the call returns; move it somewhere stable.
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.moveItem(at: tmp, to: dest)
        return dest
    }

    /// Resolve a local plaintext file for `s3Key`, downloading from `remoteURL`
    /// and decrypting with `key` if needed. Concurrent calls for the same key
    /// share one download/decrypt.
    func fileURL(for s3Key: String, from remoteURL: URL, key: SymmetricKey?) async throws -> URL {
        let dest = cacheURL(for: s3Key)
        if FileManager.default.fileExists(atPath: dest.path) { return dest }

        if let existing = inFlight[s3Key] { return try await existing.value }

        let task = Task<URL, Error> { [fetch, directory] in
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let downloaded = try await fetch(remoteURL)
            defer { try? FileManager.default.removeItem(at: downloaded) }

            // Write to a temp sibling first, then atomically move into place so a
            // partial decrypt never looks like a valid cache hit.
            let staging = directory.appendingPathComponent("staging-\(UUID().uuidString)")
            if try Self.hasMagic(downloaded), let key {
                try MediaCipher(key: key).decryptFile(at: downloaded, to: staging)
            } else {
                try FileManager.default.copyItem(at: downloaded, to: staging)
            }
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.moveItem(at: staging, to: dest)
            return dest
        }
        inFlight[s3Key] = task
        defer { inFlight[s3Key] = nil }
        return try await task.value
    }

    /// Remove all cached plaintext. Call on sign-out.
    func purge() {
        try? FileManager.default.removeItem(at: directory)
    }

    // MARK: - Helpers

    /// Cache filename: sha256(s3Key) keeps the full image's extension so the
    /// share sheet and AVPlayer infer the right type.
    private func cacheURL(for s3Key: String) -> URL {
        let digest = SHA256.hash(data: Data(s3Key.utf8))
        let name = digest.map { String(format: "%02x", $0) }.joined()
        let ext = (s3Key as NSString).pathExtension
        let base = directory.appendingPathComponent(name)
        return ext.isEmpty ? base : base.appendingPathExtension(ext)
    }

    /// True if the file begins with the `MediaCipher` "LLM1" magic.
    private static func hasMagic(_ url: URL) throws -> Bool {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        return handle.readData(ofLength: MediaCipher.magic.count) == MediaCipher.magic
    }
}
