import Foundation
import AVFoundation
import ImageIO
import UIKit
import UniformTypeIdentifiers

/// Errors specific to media upload.
enum MediaUploaderError: LocalizedError {
    case noUploadURL
    case noViewURL
    case uploadFailed(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .noUploadURL: return "The server did not return an upload URL."
        case .noViewURL: return "The server did not return a view URL."
        case .uploadFailed(let code): return "Upload failed (\(code))."
        }
    }
}

/// `MediaUploader` backed by the proxy's S3 presign routes (spec §4.1, §5.3):
/// request a presigned PUT, upload the file (streamed from disk, never fully
/// loaded into memory), return the stored `MediaItem`.
@MainActor
final class ProxyMediaUploader: MediaUploader {

    private let api: ProxyAPIClient
    private let keys: UserKeyStore
    private let session: URLSession

    /// In-memory cache of short-TTL view URLs keyed by s3Key.
    private var viewURLCache: [String: (url: URL, expiresAt: Date)] = [:]

    /// Decrypts + caches media for display (off the main actor).
    private let contentCache = MediaContentCache()

    init(api: ProxyAPIClient, keys: UserKeyStore, session: URLSession = .shared) {
        self.api = api
        self.keys = keys
        self.session = session
    }

    // MARK: - DTOs

    private struct UploadURLsRequest: Encodable {
        struct File: Encodable {
            let kind: String
            let ext: String
            let contentType: String
            let bytes: Int
            let journalId: String
            /// When set, the server reuses this stable key instead of minting a
            /// new one (Task 1) — lets a background upload re-presign the SAME key.
            var s3Key: String?
        }
        let files: [File]
    }

    private struct UploadURLsResponse: Decodable {
        struct File: Decodable {
            let s3Key: String
            let uploadUrl: URL
        }
        let files: [File]
    }

    private struct ViewURLsRequest: Encodable {
        let s3Keys: [String]
    }

    private struct ViewURLsResponse: Decodable {
        struct Entry: Decodable {
            let s3Key: String
            let viewUrl: URL
        }
        let urls: [Entry]
    }

    // MARK: - MediaUploader

    func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
        guard let dek = keys.currentDataKey else { throw CryptoUnavailableError.keyNotLoaded }
        let cipher = MediaCipher(key: dek)

        // Encrypt to a temp file and upload the ciphertext (spec §7). Metadata is
        // still probed from the ORIGINAL plaintext so dimensions/duration are accurate.
        let encryptedURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: encryptedURL) }
        try cipher.encryptFile(at: fileURL, to: encryptedURL)

        let attributes = try FileManager.default.attributesOfItem(atPath: encryptedURL.path)
        let byteCount = (attributes[.size] as? NSNumber)?.intValue ?? 0
        let ext = fileURL.pathExtension.isEmpty ? Self.defaultExtension(for: kind)
                                                : fileURL.pathExtension
        // Ciphertext is opaque; sign + send as octet-stream.
        let contentType = "application/octet-stream"

        // For images, also produce a small encrypted thumbnail uploaded as a
        // second object. ~400 px longest edge is retina-crisp at list/detail sizes.
        var thumbEncryptedURL: URL?
        if kind == .image, let thumbData = Self.thumbnailData(from: fileURL, maxEdge: 400) {
            let thumbPlain = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
            let thumbEnc = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try thumbData.write(to: thumbPlain)
            defer { try? FileManager.default.removeItem(at: thumbPlain) }
            try cipher.encryptFile(at: thumbPlain, to: thumbEnc)
            thumbEncryptedURL = thumbEnc
        }
        defer { if let t = thumbEncryptedURL { try? FileManager.default.removeItem(at: t) } }

        var requestFiles: [UploadURLsRequest.File] = [
            .init(kind: kind.rawValue, ext: ext, contentType: contentType,
                  bytes: byteCount, journalId: journalId)
        ]
        if let thumbEncryptedURL {
            let thumbBytes = ((try? FileManager.default.attributesOfItem(atPath: thumbEncryptedURL.path))?[.size] as? NSNumber)?.intValue ?? 0
            requestFiles.append(
                .init(kind: MediaKind.image.rawValue, ext: "jpg", contentType: contentType,
                      bytes: thumbBytes, journalId: journalId)
            )
        }

        let response: UploadURLsResponse = try await api.post(
            path: "/v1/media/upload-urls",
            body: UploadURLsRequest(files: requestFiles)
        )
        guard let presigned = response.files.first else {
            throw MediaUploaderError.noUploadURL
        }

        var request = URLRequest(url: presigned.uploadUrl)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        // Stream the ciphertext from disk so large videos never sit in memory.
        let (_, uploadResponse) = try await session.upload(for: request, fromFile: encryptedURL)
        if let http = uploadResponse as? HTTPURLResponse,
           !(200..<300).contains(http.statusCode) {
            throw MediaUploaderError.uploadFailed(statusCode: http.statusCode)
        }

        // Upload the thumbnail object if we have one (index 1 in the response).
        var thumbnailS3Key: String?
        if let thumbEncryptedURL, response.files.count > 1 {
            let thumbPresigned = response.files[1]
            var thumbRequest = URLRequest(url: thumbPresigned.uploadUrl)
            thumbRequest.httpMethod = "PUT"
            thumbRequest.setValue(contentType, forHTTPHeaderField: "Content-Type")
            let (_, thumbResponse) = try await session.upload(for: thumbRequest, fromFile: thumbEncryptedURL)
            if let http = thumbResponse as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                thumbnailS3Key = thumbPresigned.s3Key
            }
        }

        // Metadata from the plaintext original.
        return await Self.mediaItem(s3Key: presigned.s3Key, kind: kind, fileURL: fileURL,
                                    thumbnailS3Key: thumbnailS3Key)
    }

    func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int,
                       journalId: String) async throws -> (s3Key: String, url: URL) {
        // Ciphertext is opaque; sign + send as octet-stream.
        let contentType = "application/octet-stream"
        let response: UploadURLsResponse = try await api.post(
            path: "/v1/media/upload-urls",
            body: UploadURLsRequest(files: [
                .init(kind: kind.rawValue, ext: ext, contentType: contentType,
                      bytes: bytes, journalId: journalId, s3Key: s3Key)
            ])
        )
        guard let presigned = response.files.first else {
            throw MediaUploaderError.noUploadURL
        }
        return (presigned.s3Key, presigned.uploadUrl)
    }

    func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload {
        guard let dek = keys.currentDataKey else { throw CryptoUnavailableError.keyNotLoaded }
        let cipher = MediaCipher(key: dek)

        // Encrypt to a STABLE temp file (NOT deleted here — the caller/UploadManager
        // owns its lifecycle once it is staged in the journal). Metadata is still
        // probed from the ORIGINAL plaintext so dimensions/duration are accurate.
        let encryptedURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        try cipher.encryptFile(at: fileURL, to: encryptedURL)

        let attributes = try FileManager.default.attributesOfItem(atPath: encryptedURL.path)
        let byteCount = (attributes[.size] as? NSNumber)?.intValue ?? 0
        let ext = fileURL.pathExtension.isEmpty ? Self.defaultExtension(for: kind)
                                                : fileURL.pathExtension

        // On SUCCESS, ownership of the ciphertext temp file transfers to the
        // caller/UploadManager (so we do NOT delete it here). But if anything
        // AFTER encryptFile throws (e.g. presign fails), the ciphertext would be
        // orphaned — so remove it before rethrowing.
        do {
            // MINT a stable key up front so a relaunch can re-presign the same object.
            let (s3Key, _) = try await presignUpload(
                s3Key: nil, kind: kind, ext: ext, bytes: byteCount, journalId: journalId)

            // Metadata from the plaintext original (audio/video have no thumbnail here).
            let item = await Self.mediaItem(s3Key: s3Key, kind: kind, fileURL: fileURL,
                                            thumbnailS3Key: nil)
            return PreparedUpload(encryptedFileURL: encryptedURL, s3Key: s3Key, mediaItem: item)
        } catch {
            try? FileManager.default.removeItem(at: encryptedURL)
            throw error
        }
    }

    func viewURL(for s3Key: String) async throws -> URL {
        if let cached = cachedViewURL(for: s3Key) { return cached }

        let response: ViewURLsResponse = try await api.post(
            path: "/v1/media/view-urls",
            body: ViewURLsRequest(s3Keys: [s3Key])
        )
        guard let entry = response.urls.first(where: { $0.s3Key == s3Key }) else {
            throw MediaUploaderError.noViewURL
        }

        // Presigned GETs have a 1 h TTL (spec §5.3); refresh a bit early.
        cacheViewURL(entry.viewUrl, for: s3Key, expiresAt: Date().addingTimeInterval(50 * 60))
        return entry.viewUrl
    }

    func localFileURL(for s3Key: String) async throws -> URL {
        let remote = try await viewURL(for: s3Key)
        return try await contentCache.fileURL(for: s3Key, from: remote, key: keys.currentDataKey)
    }

    /// Clears decrypted plaintext from disk (call on sign-out).
    func purgeContentCache() async {
        await contentCache.purge()
    }

    // MARK: - Helpers

    private func cachedViewURL(for s3Key: String) -> URL? {
        guard let cached = viewURLCache[s3Key], cached.expiresAt > Date() else { return nil }
        return cached.url
    }

    private func cacheViewURL(_ url: URL, for s3Key: String, expiresAt: Date) {
        viewURLCache[s3Key] = (url, expiresAt)
    }

    private static func defaultExtension(for kind: MediaKind) -> String {
        switch kind {
        case .image: return "jpg"
        case .video: return "mp4"
        case .audio: return "m4a"
        }
    }

    /// MIME type for the upload's `Content-Type` header, derived from the
    /// file extension via UTType.
    private static func mimeType(forExtension ext: String) -> String {
        UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
    }

    /// Downscaled JPEG thumbnail (longest edge ≤ `maxEdge`) for an image file,
    /// or nil if the file isn't a decodable image. Uses ImageIO so the full
    /// image never fully decompresses into memory.
    nonisolated static func thumbnailData(from fileURL: URL, maxEdge: CGFloat) -> Data? {
        guard let source = CGImageSourceCreateWithURL(fileURL as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxEdge,
        ]
        guard let cgThumb = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        return UIImage(cgImage: cgThumb).jpegData(compressionQuality: 0.8)
    }

    /// Build a `MediaItem`, probing local metadata (dimensions, duration).
    static func mediaItem(s3Key: String, kind: MediaKind, fileURL: URL,
                          thumbnailS3Key: String? = nil) async -> MediaItem {
        var item = MediaItem(s3Key: s3Key, kind: kind, thumbnailS3Key: thumbnailS3Key)
        switch kind {
        case .image:
            if let image = UIImage(contentsOfFile: fileURL.path) {
                item.width = Int(image.size.width * image.scale)
                item.height = Int(image.size.height * image.scale)
            }
        case .video, .audio:
            let asset = AVURLAsset(url: fileURL)
            if let duration = try? await asset.load(.duration) {
                let seconds = CMTimeGetSeconds(duration)
                if seconds.isFinite, seconds > 0 { item.durationSec = seconds }
            }
            if kind == .video,
               let track = try? await asset.loadTracks(withMediaType: .video).first,
               let (naturalSize, transform) = try? await track.load(.naturalSize, .preferredTransform) {
                let size = naturalSize.applying(transform)
                item.width = Int(abs(size.width))
                item.height = Int(abs(size.height))
            }
        }
        return item
    }
}
