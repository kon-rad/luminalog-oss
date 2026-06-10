import Foundation

/// Uploads media files and resolves display URLs — S3 presigned URLs via the
/// proxy in production, local files in demo mode.
protocol MediaUploader: AnyObject {

    /// Upload a local file and return its stored `MediaItem`.
    func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem

    /// Resolve a (short-lived) URL for displaying/playing a stored media item.
    func viewURL(for s3Key: String) async throws -> URL
}
