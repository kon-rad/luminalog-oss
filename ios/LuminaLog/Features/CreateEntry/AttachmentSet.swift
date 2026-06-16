import AVFoundation
import Foundation
import UIKit

// MARK: - Attachment values

/// A photo staged for upload (JPEG/HEIC data plus a display thumbnail).
struct PhotoAttachment: Identifiable, Equatable {
    let id: UUID
    let imageData: Data
    let thumbnail: UIImage?
    let pixelWidth: Int?
    let pixelHeight: Int?

    init(
        id: UUID = UUID(),
        imageData: Data,
        thumbnail: UIImage? = nil,
        pixelWidth: Int? = nil,
        pixelHeight: Int? = nil
    ) {
        self.id = id
        self.imageData = imageData
        self.thumbnail = thumbnail
        self.pixelWidth = pixelWidth
        self.pixelHeight = pixelHeight
    }

    static func == (lhs: PhotoAttachment, rhs: PhotoAttachment) -> Bool {
        lhs.id == rhs.id
    }

    /// Build from picked image data, decoding once for size + thumbnail.
    static func make(from data: Data) async -> PhotoAttachment {
        guard let image = UIImage(data: data) else {
            return PhotoAttachment(imageData: data)
        }
        let thumbnail = await image.byPreparingThumbnail(
            ofSize: CGSize(width: 240, height: 240)
        )
        return PhotoAttachment(
            imageData: data,
            thumbnail: thumbnail ?? image,
            pixelWidth: Int(image.size.width * image.scale),
            pixelHeight: Int(image.size.height * image.scale)
        )
    }

    /// Write the image data to a temporary file for upload.
    func writeToTemporaryFile() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(id.uuidString).jpg")
        try imageData.write(to: url)
        return url
    }

    /// Generate a JPEG thumbnail capped at `maxDimension` pixels on the
    /// longest side. Returns the original data unchanged when the image is
    /// already within the limit.
    func makeThumbnailData(maxDimension: CGFloat = 200) -> Data? {
        guard let image = UIImage(data: imageData) else { return nil }
        let pixelWidth = image.size.width * image.scale
        let pixelHeight = image.size.height * image.scale
        let longestSide = max(pixelWidth, pixelHeight)
        guard longestSide > maxDimension else { return imageData }
        let scale = maxDimension / longestSide
        let thumbSize = CGSize(
            width: (pixelWidth * scale).rounded(),
            height: (pixelHeight * scale).rounded()
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: thumbSize, format: format)
        let thumb = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: thumbSize)) }
        return thumb.jpegData(compressionQuality: 0.7)
    }

    /// Write thumbnail data to a temporary file for upload.
    func writeThumbnailToTemporaryFile(data: Data) throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(id.uuidString)_thumb.jpg")
        try data.write(to: url)
        return url
    }
}

/// A video staged for upload.
struct VideoAttachment: Identifiable, Equatable {
    let id: UUID
    let url: URL
    let thumbnail: UIImage?
    let durationSec: Double?

    init(id: UUID = UUID(), url: URL, thumbnail: UIImage? = nil, durationSec: Double? = nil) {
        self.id = id
        self.url = url
        self.thumbnail = thumbnail
        self.durationSec = durationSec
    }

    static func == (lhs: VideoAttachment, rhs: VideoAttachment) -> Bool {
        lhs.id == rhs.id
    }

    /// Build from a local video file, loading duration + a poster frame.
    static func make(from url: URL) async -> VideoAttachment {
        let asset = AVURLAsset(url: url)
        let duration = try? await asset.load(.duration).seconds

        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 480, height: 480)
        let cgImage = try? await generator.image(at: .zero).image

        return VideoAttachment(
            url: url,
            thumbnail: cgImage.map { UIImage(cgImage: $0) },
            durationSec: duration
        )
    }
}

/// A recorded voice memo staged for upload.
struct AudioAttachment: Identifiable, Equatable {
    let id: UUID
    let url: URL
    let durationSec: Double

    init(id: UUID = UUID(), url: URL, durationSec: Double) {
        self.id = id
        self.url = url
        self.durationSec = durationSec
    }
}

// MARK: - AttachmentSet

/// The staged attachments of a draft entry, with the entry-type rules.
///
/// Type rules (kept deliberately simple — the design doesn't spec mixing):
/// - video attached            → `.video` (one video max; adding it clears
///   photos/audio, the view confirms first)
/// - photos attached, no video → `.image` (up to 10 photos)
/// - audio, no video/photos    → `.voice` (one recording max)
/// - nothing attached          → `.text`
/// - photos + audio            → photos win: `.image`; the audio is dropped
///   (or recording is blocked) with an inline notice.
struct AttachmentSet: Equatable {

    static let maxPhotos = 10

    private(set) var photos: [PhotoAttachment] = []
    private(set) var video: VideoAttachment?
    private(set) var audio: AudioAttachment?

    var isEmpty: Bool { photos.isEmpty && video == nil && audio == nil }

    /// The journal type this attachment set produces (rules above).
    var entryType: JournalType {
        if video != nil { return .video }
        if !photos.isEmpty { return .image }
        if audio != nil { return .voice }
        return .text
    }

    /// Recording is blocked while photos or a video are attached.
    var canRecordAudio: Bool { photos.isEmpty && video == nil }

    /// Whether attaching a video must be confirmed first (it would replace
    /// existing photos/audio).
    var videoNeedsReplacementConfirm: Bool { !photos.isEmpty || audio != nil }

    // MARK: Mutations (each returns an optional inline-notice message)

    @discardableResult
    mutating func addPhotos(_ newPhotos: [PhotoAttachment]) -> String? {
        guard video == nil else {
            return "Remove the video to attach photos."
        }
        var notice: String?
        if audio != nil {
            audio = nil
            notice = "Voice recording removed — photo entries keep photos only."
        }
        photos.append(contentsOf: newPhotos)
        if photos.count > Self.maxPhotos {
            photos = Array(photos.prefix(Self.maxPhotos))
            notice = "Up to \(Self.maxPhotos) photos per entry."
        }
        return notice
    }

    mutating func removePhoto(id: UUID) {
        photos.removeAll { $0.id == id }
    }

    /// Attach the (single) video, clearing photos/audio. The view is
    /// responsible for confirming when `videoNeedsReplacementConfirm`.
    mutating func setVideo(_ newVideo: VideoAttachment) {
        photos = []
        audio = nil
        video = newVideo
    }

    mutating func removeVideo() {
        video = nil
    }

    /// Attach the (single) voice recording. Returns a notice and drops the
    /// recording when photos/video take priority (rules above).
    @discardableResult
    mutating func setAudio(_ newAudio: AudioAttachment) -> String? {
        guard canRecordAudio else {
            return "Recording wasn't kept — photo and video entries don't include voice memos."
        }
        audio = newAudio
        return nil
    }

    mutating func removeAudio() {
        audio = nil
    }
}
