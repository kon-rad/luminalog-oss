import AVFoundation
import Foundation

/// Errors surfaced by `AudioExtractor`.
enum AudioExtractorError: LocalizedError {
    /// The video has no audio track or the export session can't be created.
    case notExportable
    /// The export ran but did not complete successfully.
    case exportFailed

    var errorDescription: String? {
        switch self {
        case .notExportable:
            return "Audio couldn't be read from that video."
        case .exportFailed:
            return "Audio couldn't be extracted from that video."
        }
    }
}

/// Extracts the audio track of a video into a temporary `.m4a` file so it can
/// be fed to on-device speech recognition (spec §2.3, video entries).
enum AudioExtractor {

    static func extractAudio(from videoURL: URL) async throws -> URL {
        let asset = AVURLAsset(url: videoURL)

        let audioTracks = try await asset.loadTracks(withMediaType: .audio)
        guard !audioTracks.isEmpty,
              let session = AVAssetExportSession(
                asset: asset,
                presetName: AVAssetExportPresetAppleM4A
              )
        else {
            throw AudioExtractorError.notExportable
        }

        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).m4a")

        if #available(iOS 18, *) {
            do {
                try await session.export(to: outputURL, as: .m4a)
            } catch {
                throw AudioExtractorError.exportFailed
            }
        } else {
            session.outputURL = outputURL
            session.outputFileType = .m4a
            await session.export()
            guard session.status == .completed else {
                throw AudioExtractorError.exportFailed
            }
        }
        return outputURL
    }
}
