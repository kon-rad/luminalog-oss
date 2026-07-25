import AVFoundation
import Foundation

/// Measures and concatenates recorded audio segments. Segments are AAC-in-CAF
/// files; the merged output is a single `.m4a` (AAC) so the existing upload /
/// transcription pipeline is unchanged. An unreadable (crash-truncated) segment
/// is skipped rather than aborting the whole merge.
protocol RecordingMerging: Sendable {
    /// True on-disk duration of `url`, or 0 if it can't be read.
    func duration(of url: URL) async -> TimeInterval
    /// Concatenates `segments` in order into `out` (`.m4a`). Throws if nothing
    /// readable remains.
    func merge(_ segments: [URL], to out: URL) async throws
}

enum RecordingMergeError: Error { case noReadableSegments, exportInit, exportFailed }

struct RecordingMerger: RecordingMerging {

    init() {}

    func duration(of url: URL) async -> TimeInterval {
        let asset = AVURLAsset(url: url)
        guard let d = try? await asset.load(.duration), d.isNumeric else { return 0 }
        let seconds = CMTimeGetSeconds(d)
        return seconds.isFinite && seconds > 0 ? seconds : 0
    }

    func merge(_ segments: [URL], to out: URL) async throws {
        let composition = AVMutableComposition()
        guard let track = composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else { throw RecordingMergeError.exportInit }

        var cursor = CMTime.zero
        for url in segments {
            let asset = AVURLAsset(url: url)
            guard
                let sourceTrack = try? await asset.loadTracks(withMediaType: .audio).first,
                let duration = try? await asset.load(.duration),
                duration.isNumeric, duration > .zero
            else { continue }   // skip unreadable / empty (crash-truncated) segment
            try track.insertTimeRange(
                CMTimeRange(start: .zero, duration: duration),
                of: sourceTrack,
                at: cursor
            )
            cursor = cursor + duration
        }
        guard cursor > .zero else { throw RecordingMergeError.noReadableSegments }

        try? FileManager.default.removeItem(at: out)
        guard let export = AVAssetExportSession(
            asset: composition,
            presetName: AVAssetExportPresetAppleM4A
        ) else { throw RecordingMergeError.exportInit }

        try await export.export(to: out, as: .m4a)
    }
}
