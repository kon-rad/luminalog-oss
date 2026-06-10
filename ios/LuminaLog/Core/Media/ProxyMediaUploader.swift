import Foundation
import AVFoundation
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
    private let session: URLSession

    /// In-memory cache of short-TTL view URLs keyed by s3Key.
    private var viewURLCache: [String: (url: URL, expiresAt: Date)] = [:]

    init(api: ProxyAPIClient, session: URLSession = .shared) {
        self.api = api
        self.session = session
    }

    // MARK: - DTOs

    private struct UploadURLsRequest: Encodable {
        struct File: Encodable {
            let kind: String
            let ext: String
            let bytes: Int
            let journalId: String
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
            let url: URL
        }
        let urls: [Entry]
    }

    // MARK: - MediaUploader

    func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
        let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
        let byteCount = (attributes[.size] as? NSNumber)?.intValue ?? 0
        let ext = fileURL.pathExtension.isEmpty ? Self.defaultExtension(for: kind)
                                                : fileURL.pathExtension

        let response: UploadURLsResponse = try await api.post(
            path: "/v1/s3/upload-urls",
            body: UploadURLsRequest(files: [
                .init(kind: kind.rawValue, ext: ext, bytes: byteCount, journalId: journalId)
            ])
        )
        guard let presigned = response.files.first else {
            throw MediaUploaderError.noUploadURL
        }

        var request = URLRequest(url: presigned.uploadUrl)
        request.httpMethod = "PUT"
        request.setValue(Self.mimeType(forExtension: ext), forHTTPHeaderField: "Content-Type")
        // Stream the file from disk so large videos never sit in memory.
        let (_, uploadResponse) = try await session.upload(for: request, fromFile: fileURL)
        if let http = uploadResponse as? HTTPURLResponse,
           !(200..<300).contains(http.statusCode) {
            throw MediaUploaderError.uploadFailed(statusCode: http.statusCode)
        }

        return await Self.mediaItem(s3Key: presigned.s3Key, kind: kind, fileURL: fileURL)
    }

    func viewURL(for s3Key: String) async throws -> URL {
        if let cached = cachedViewURL(for: s3Key) { return cached }

        let response: ViewURLsResponse = try await api.post(
            path: "/v1/s3/view-urls",
            body: ViewURLsRequest(s3Keys: [s3Key])
        )
        guard let entry = response.urls.first(where: { $0.s3Key == s3Key }) else {
            throw MediaUploaderError.noViewURL
        }

        // Presigned GETs have a 1 h TTL (spec §5.3); refresh a bit early.
        cacheViewURL(entry.url, for: s3Key, expiresAt: Date().addingTimeInterval(50 * 60))
        return entry.url
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

    /// Build a `MediaItem`, probing local metadata (dimensions, duration).
    static func mediaItem(s3Key: String, kind: MediaKind, fileURL: URL) async -> MediaItem {
        var item = MediaItem(s3Key: s3Key, kind: kind)
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
