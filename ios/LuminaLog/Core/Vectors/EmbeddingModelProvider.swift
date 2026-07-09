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

/// Fetches raw bytes for a URL. Abstracted so `EmbeddingModelProvider` can be unit
/// tested with a fake (no network) — the production conformer is
/// `URLSessionFileDownloader`.
protocol EmbeddingFileDownloader {
    func download(from url: URL) async throws -> Data
}

/// `URLSession`-backed downloader for release/dev builds.
struct URLSessionFileDownloader: EmbeddingFileDownloader {
    let session: URLSession
    init(session: URLSession = .shared) { self.session = session }

    func download(from url: URL) async throws -> Data {
        let (data, _) = try await session.data(from: url)
        return data
    }
}

/// Downloads the MiniLM ONNX model + tokenizer from a **configurable** URL,
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
        if let cached = try? Data(contentsOf: destination),
           Self.sha256Hex(of: cached) == asset.sha256Hex {
            return destination
        }

        let data = try await downloader.download(from: asset.url)
        let actual = Self.sha256Hex(of: data)
        guard actual == asset.sha256Hex else {
            throw EmbeddingModelProviderError.integrityCheckFailed(
                expected: asset.sha256Hex, actual: actual
            )
        }

        // Only verified bytes reach the cache — write to a temp file, then move it
        // into place atomically so a partial/failed write can never be observed.
        try fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        let temp = cacheDirectory.appendingPathComponent("\(asset.filename).\(UUID().uuidString).tmp")
        try data.write(to: temp, options: .atomic)
        if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
        }
        try fileManager.moveItem(at: temp, to: destination)
        return destination
    }

    /// Lowercase hex SHA-256 of `data`.
    static func sha256Hex(of data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
