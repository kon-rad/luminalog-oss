import Foundation

/// Result of staging a file for background upload: ciphertext on disk + a
/// stable s3Key + the `MediaItem` metadata (duration/dimensions/thumbnail).
struct PreparedUpload {
    let encryptedFileURL: URL
    let s3Key: String
    let mediaItem: MediaItem
}

/// Uploads media files and resolves display URLs — S3 presigned URLs via the
/// proxy in production, local files in demo mode.
@MainActor
protocol MediaUploader: AnyObject {

    /// Upload a local file and return its stored `MediaItem`.
    func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem

    /// Encrypt `fileURL` to a temp ciphertext file, mint+return a STABLE s3Key,
    /// and probe metadata — but do NOT PUT. Used for background uploads so the
    /// processor never touches the DEK/cipher directly.
    func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload

    /// Presign a PUT URL for a (possibly pre-existing) stable s3Key. When
    /// `s3Key` is nil the server mints one.
    func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int, journalId: String) async throws -> (s3Key: String, url: URL)

    /// Resolve a (short-lived) URL for displaying/playing a stored media item.
    func viewURL(for s3Key: String) async throws -> URL

    /// Resolve a **decrypted** local file URL for displaying/playing a stored
    /// media item. Downloads ciphertext, decrypts, and caches the plaintext.
    func localFileURL(for s3Key: String) async throws -> URL
}
