import Foundation
import CryptoKit

/// A remote asset the embedder needs on disk (the ONNX model or the tokenizer
/// bundle): where to fetch it, the SHA-256 it must hash to, and the filename to cache
/// it under. The URL is **never hardcoded** — it comes from config (`AppConfig`) /
/// dev flags so the bucket can change without a code change (increment 1c-D, founder
/// decision: self-hosted CDN + integrity hash).
struct EmbeddingModelAsset: Equatable {
    /// Remote download location (configurable; empty/placeholder until hosted).
    let url: URL
    /// Lowercase hex SHA-256 the downloaded bytes must match, or the download is
    /// rejected (no cache poisoning).
    let sha256Hex: String
    /// Local filename to cache the verified bytes under.
    let filename: String

    init(url: URL, sha256Hex: String, filename: String) {
        self.url = url
        self.sha256Hex = sha256Hex.lowercased()
        self.filename = filename
    }
}

enum EmbeddingModelProviderError: LocalizedError, Equatable {
    /// The downloaded bytes did not match the expected SHA-256.
    case integrityCheckFailed(expected: String, actual: String)
    /// A configured asset URL was missing/blank (not yet hosted).
    case notConfigured

    var errorDescription: String? {
        switch self {
        case .integrityCheckFailed(let expected, let actual):
            return "Downloaded model failed its integrity check (expected \(expected), got \(actual))."
        case .notConfigured:
            return "The embedding model download URL is not configured."
        }
    }
}

/// Downloads a URL to a **local temp file** and returns its URL — the caller takes
/// ownership (moves or deletes it). Streaming to disk (rather than returning `Data`)
/// keeps the ~258 MB model off the heap. Abstracted so `EmbeddingModelProvider` can be
/// unit tested with a fake (no network) — the production conformer is
/// `URLSessionFileDownloader`.
protocol EmbeddingFileDownloader {
    func download(from url: URL) async throws -> URL
}

/// `URLSession`-backed downloader for release/dev builds. Uses the async
/// `download(from:)` so bytes stream to a temp file on disk instead of buffering the
/// whole (258 MB) model into RAM.
struct URLSessionFileDownloader: EmbeddingFileDownloader {
    let session: URLSession
    private let fileManager: FileManager
    init(session: URLSession = .shared, fileManager: FileManager = .default) {
        self.session = session
        self.fileManager = fileManager
    }

    func download(from url: URL) async throws -> URL {
        let (tempURL, _) = try await session.download(from: url)
        // `URLSession`'s managed temp file is not guaranteed to outlive this call, so
        // move it into a temp path we own before handing it back.
        let owned = fileManager.temporaryDirectory
            .appendingPathComponent("emb-download-\(UUID().uuidString).tmp")
        try? fileManager.removeItem(at: owned)
        try fileManager.moveItem(at: tempURL, to: owned)
        return owned
    }
}

/// Downloads the distiluse ONNX model + tokenizer from a **configurable** URL,
/// verifies a SHA-256 integrity hash, and caches the verified bytes to disk
/// (Application Support), returning the local file URL. A subsequent request for an
/// asset whose cached bytes still match the expected hash is served from disk with no
/// network call; a hash mismatch (corruption or a swapped file) is rejected and the
/// cache is left untouched — verified bytes are only ever moved into place atomically
/// after the check passes, so a bad download can never poison the cache.
///
/// The provider owns no ML logic — it just guarantees the bytes on disk are exactly
/// the expected artifact.
struct EmbeddingModelProvider {

    private let downloader: EmbeddingFileDownloader
    private let cacheDirectory: URL
    private let fileManager: FileManager

    /// - Parameters:
    ///   - downloader: byte source (inject a fake in tests).
    ///   - cacheDirectory: where verified assets are cached. Defaults to
    ///     `Application Support/EmbeddingModel`.
    ///   - fileManager: injected for testability.
    init(
        downloader: EmbeddingFileDownloader = URLSessionFileDownloader(),
        cacheDirectory: URL? = nil,
        fileManager: FileManager = .default
    ) {
        self.downloader = downloader
        self.fileManager = fileManager
        if let cacheDirectory {
            self.cacheDirectory = cacheDirectory
        } else {
            let base = (try? fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )) ?? fileManager.temporaryDirectory
            self.cacheDirectory = base.appendingPathComponent("EmbeddingModel", isDirectory: true)
        }
    }

    /// The local path an asset caches to (whether or not it currently exists).
    func localURL(for asset: EmbeddingModelAsset) -> URL {
        cacheDirectory.appendingPathComponent(asset.filename, isDirectory: false)
    }

    /// Ensure the asset is present on disk and integrity-verified, returning its local
    /// URL.
    ///
    /// * Cached + hash matches → returned immediately, **no download**.
    /// * Cached but hash mismatches (corrupt/stale) → re-downloaded.
    /// * Not cached → downloaded.
    ///
    /// The freshly downloaded bytes are hashed *before* being written to the cache
    /// path; on mismatch the method throws `integrityCheckFailed` and the cache path
    /// is left as it was (no poisoning).
    func fetch(_ asset: EmbeddingModelAsset) async throws -> URL {
        let destination = localURL(for: asset)

        // Reuse a good cached copy without touching the network.
        if fileManager.fileExists(atPath: destination.path) {
            // Fast path: a sidecar marker recording the verified hash + byte size lets
            // us skip re-hashing the whole (258 MB) file on every resolve/cold start.
            if verifiedMarkerMatches(asset, at: destination) {
                return destination
            }
            // No/stale marker (e.g. a legacy cache written before markers existed) —
            // fall back to a full STREAMED verify (constant memory), and adopt the
            // marker on a match so the next resolve takes the fast path.
            if (try? Self.sha256Hex(ofFileAt: destination)) == asset.sha256Hex {
                writeVerifiedMarker(asset, at: destination)
                return destination
            }
        }

        // Streams to a temp file on disk (the caller owns it — clean it up regardless).
        let tempURL = try await downloader.download(from: asset.url)
        defer { try? fileManager.removeItem(at: tempURL) }

        let actual = try Self.sha256Hex(ofFileAt: tempURL)
        guard actual == asset.sha256Hex else {
            throw EmbeddingModelProviderError.integrityCheckFailed(
                expected: asset.sha256Hex, actual: actual
            )
        }

        // Only verified bytes reach the cache — move the temp file into place
        // atomically so a partial/failed write can never be observed.
        try fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
        }
        try fileManager.moveItem(at: tempURL, to: destination)
        writeVerifiedMarker(asset, at: destination)
        return destination
    }

    // MARK: - Verified marker (skip cold-start re-hash)

    /// Sidecar path recording that `destination`'s bytes were verified.
    private func markerURL(for destination: URL) -> URL {
        destination.appendingPathExtension("verified")
    }

    /// Current byte size of the file at `url`, or nil if it can't be read.
    private func byteSize(at url: URL) -> Int? {
        guard let attrs = try? fileManager.attributesOfItem(atPath: url.path) else { return nil }
        return (attrs[.size] as? NSNumber)?.intValue
    }

    /// True iff a sidecar records this asset's expected hash AND the current file's byte
    /// size still matches — a cheap check (no full re-hash) that still catches a
    /// truncated/replaced file. A hash mismatch (expected artifact changed) or a size
    /// mismatch both fail, forcing a full verify.
    private func verifiedMarkerMatches(_ asset: EmbeddingModelAsset, at destination: URL) -> Bool {
        guard let contents = try? String(contentsOf: markerURL(for: destination), encoding: .utf8) else {
            return false
        }
        let parts = contents.split(separator: " ")
        guard parts.count == 2, String(parts[0]) == asset.sha256Hex else { return false }
        return byteSize(at: destination).map(String.init) == String(parts[1])
    }

    /// Record "these bytes were verified to `sha256Hex`, `size` bytes" beside the file.
    /// Best-effort — a missing marker just means the next resolve does a full verify.
    private func writeVerifiedMarker(_ asset: EmbeddingModelAsset, at destination: URL) {
        let size = byteSize(at: destination) ?? 0
        try? "\(asset.sha256Hex) \(size)".write(
            to: markerURL(for: destination), atomically: true, encoding: .utf8)
    }

    /// Lowercase hex SHA-256 of `data`.
    static func sha256Hex(of data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    /// Lowercase hex SHA-256 of the file at `url`, streamed in 1 MB chunks so a large
    /// (258 MB) model is never loaded whole into memory.
    static func sha256Hex(ofFileAt url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while let chunk = try handle.read(upToCount: 1 << 20), !chunk.isEmpty {
            hasher.update(data: chunk)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }
}
