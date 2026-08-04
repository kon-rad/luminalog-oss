import AVFoundation
import Foundation
import os
import OSLog

/// Prepares a recording for the stateless `/transcribe-clip` endpoint so an
/// upload never exceeds the server's 25 MB body limit:
///
/// - **Down-samples** to 16 kHz mono AAC (Whisper's working rate — this is
///   ASR-lossless and shrinks a 44.1 kHz stereo capture several-fold).
/// - **Chunks** the timeline into ≤ `maxChunkSeconds` windows so even an
///   arbitrarily long recording is sent as a series of small requests, each of
///   which the caller transcribes and concatenates.
protocol AudioTranscriptionPreparing: Sendable {
    /// Returns one compressed `.m4a` file per chunk, in order. The caller owns the
    /// files and deletes them. A clip that already fits yields a single file.
    func prepareChunks(from sourceURL: URL, maxChunkSeconds: Double) async throws -> [URL]
}

enum AudioPreparationError: Error {
    case noAudioTrack
    case readerInit
    case writerInit
    case exportFailed
}

struct AudioTranscriptionPreparer: AudioTranscriptionPreparing {

    /// 16 kHz mono is the rate Whisper resamples to internally, so there is no
    /// transcription-quality loss from encoding at it here.
    var sampleRate: Double = 16_000
    var bitRate: Int = 32_000

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "audio-prepare")

    func prepareChunks(from sourceURL: URL, maxChunkSeconds: Double) async throws -> [URL] {
        let asset = AVURLAsset(url: sourceURL)
        guard let track = try await asset.loadTracks(withMediaType: .audio).first else {
            throw AudioPreparationError.noAudioTrack
        }
        let duration = CMTimeGetSeconds((try? await asset.load(.duration)) ?? .zero)
        let ranges = AudioChunkPlanner.ranges(totalSeconds: duration, maxChunkSeconds: maxChunkSeconds)
        guard !ranges.isEmpty else { throw AudioPreparationError.exportFailed }

        var outputs: [URL] = []
        do {
            for (index, range) in ranges.enumerated() {
                let out = FileManager.default.temporaryDirectory
                    .appendingPathComponent("clip-\(UUID().uuidString)-\(index).m4a")
                try await export(asset: asset, track: track, range: range, to: out)
                outputs.append(out)
            }
        } catch {
            // Don't leak partial chunks if a later export fails.
            outputs.forEach { try? FileManager.default.removeItem(at: $0) }
            throw error
        }
        return outputs
    }

    /// Re-encodes one time-range of `track` to 16 kHz mono AAC at `out`, rebasing
    /// the chunk so its audio starts at t=0. Reader→writer sample pump.
    private func export(
        asset: AVAsset,
        track: AVAssetTrack,
        range: AudioChunkPlanner.ChunkRange,
        to out: URL
    ) async throws {
        try? FileManager.default.removeItem(at: out)

        guard let reader = try? AVAssetReader(asset: asset) else {
            throw AudioPreparationError.readerInit
        }
        let start = CMTime(seconds: range.start, preferredTimescale: 600)
        let dur = CMTime(seconds: range.duration, preferredTimescale: 600)
        reader.timeRange = CMTimeRange(start: start, duration: dur)

        let readerOutput = AVAssetReaderTrackOutput(track: track, outputSettings: [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: 1,
        ])
        guard reader.canAdd(readerOutput) else { throw AudioPreparationError.readerInit }
        reader.add(readerOutput)

        guard let writer = try? AVAssetWriter(outputURL: out, fileType: .m4a) else {
            throw AudioPreparationError.writerInit
        }
        let writerInput = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: bitRate,
        ])
        writerInput.expectsMediaDataInRealTime = false
        guard writer.canAdd(writerInput) else { throw AudioPreparationError.writerInit }
        writer.add(writerInput)

        guard reader.startReading() else { throw AudioPreparationError.exportFailed }
        guard writer.startWriting() else { throw AudioPreparationError.exportFailed }
        // Origin at `start` so the trimmed chunk's first sample lands at t=0 in the
        // output rather than carrying its source-timeline offset.
        writer.startSession(atSourceTime: start)

        await Self.pump(
            input: writerInput, output: readerOutput,
            queue: DispatchQueue(label: "audio-prepare.pump"))

        await writer.finishWriting()
        guard writer.status == .completed else {
            throw writer.error ?? reader.error ?? AudioPreparationError.exportFailed
        }
    }

    /// Drains re-encoded samples from `output` into `input` until the reader is
    /// exhausted, then marks the input finished. The caller awaits
    /// `writer.finishWriting()` afterwards. Mirrors `VideoTranscoder.pump`: the
    /// pump exclusively owns `input`/`output` on its own serial `queue`, so the
    /// confinement makes these non-Sendable AV objects safe to capture.
    private static func pump(
        input: AVAssetWriterInput,
        output: AVAssetReaderTrackOutput,
        queue: DispatchQueue
    ) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            nonisolated(unsafe) let input = input
            nonisolated(unsafe) let output = output
            // The callback can fire again after we finish; resume exactly once.
            let lock = OSAllocatedUnfairLock(initialState: false)
            func resumeOnce() {
                let shouldResume = lock.withLock { resumed -> Bool in
                    if resumed { return false }
                    resumed = true
                    return true
                }
                if shouldResume { cont.resume() }
            }
            input.requestMediaDataWhenReady(on: queue) {
                while input.isReadyForMoreMediaData {
                    if let sample = output.copyNextSampleBuffer() {
                        if !input.append(sample) {
                            // Writer dropped into a failed state; stop pulling samples.
                            input.markAsFinished()
                            resumeOnce(); return
                        }
                    } else {
                        input.markAsFinished()
                        resumeOnce(); return
                    }
                }
            }
        }
    }
}
