import Foundation
import AVFoundation

/// Transcodes a source video to 720p HEVC (~2.5 Mbps) via an AVAssetReader →
/// AVAssetWriter pass. There is no stock HEVC-720p export preset, so we drive
/// the pipeline directly to hit a precise codec/size/bitrate target. Portrait
/// orientation is preserved via the source track's preferredTransform.
struct VideoTranscoder {

    struct Options {
        var maxLongEdge: CGFloat = 1280
        var videoBitrate: Int = 2_500_000
        var audioBitrate: Int = 96_000
        init() {}
    }

    enum TranscodeError: Error { case noVideoTrack, readerFailed, writerFailed }

    /// True when the source is worth transcoding (larger than the target long edge).
    func shouldTranscode(source: URL, options: Options = Options()) async -> Bool {
        let asset = AVURLAsset(url: source)
        guard let track = try? await asset.loadTracks(withMediaType: .video).first,
              let size = try? await track.load(.naturalSize) else { return false }
        return max(abs(size.width), abs(size.height)) > options.maxLongEdge
    }

    func transcode(source: URL, to destination: URL, options: Options = Options()) async throws {
        let asset = AVURLAsset(url: source)
        guard let videoTrack = try await asset.loadTracks(withMediaType: .video).first else {
            throw TranscodeError.noVideoTrack
        }
        try? FileManager.default.removeItem(at: destination)

        let reader = try AVAssetReader(asset: asset)
        let writer = try AVAssetWriter(outputURL: destination, fileType: .mp4)

        let natural = try await videoTrack.load(.naturalSize)
        let transform = (try? await videoTrack.load(.preferredTransform)) ?? .identity
        let oriented = natural.applying(transform)
        let (w, h) = Self.targetSize(width: abs(oriented.width), height: abs(oriented.height),
                                     maxLongEdge: options.maxLongEdge)

        let videoOut = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
        ])
        videoOut.alwaysCopiesSampleData = false
        guard reader.canAdd(videoOut) else { throw TranscodeError.readerFailed }
        reader.add(videoOut)

        let videoIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.hevc,
            AVVideoWidthKey: w, AVVideoHeightKey: h,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: options.videoBitrate,
                AVVideoExpectedSourceFrameRateKey: 30,
            ],
        ])
        videoIn.expectsMediaDataInRealTime = false
        videoIn.transform = transform
        guard writer.canAdd(videoIn) else { throw TranscodeError.writerFailed }
        writer.add(videoIn)

        var audioOut: AVAssetReaderTrackOutput?
        var audioIn: AVAssetWriterInput?
        if let audioTrack = try await asset.loadTracks(withMediaType: .audio).first {
            let aOut = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: [
                AVFormatIDKey: kAudioFormatLinearPCM,
            ])
            if reader.canAdd(aOut) {
                reader.add(aOut); audioOut = aOut
                let aIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [
                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                    AVNumberOfChannelsKey: 2,
                    AVSampleRateKey: 44_100,
                    AVEncoderBitRateKey: options.audioBitrate,
                ])
                aIn.expectsMediaDataInRealTime = false
                if writer.canAdd(aIn) { writer.add(aIn); audioIn = aIn }
            }
        }

        guard reader.startReading() else { throw TranscodeError.readerFailed }
        guard writer.startWriting() else { throw TranscodeError.writerFailed }
        writer.startSession(atSourceTime: .zero)

        await withTaskGroup(of: Void.self) { group in
            let q = DispatchQueue(label: "transcode.video")
            group.addTask { await Self.pump(input: videoIn, output: videoOut, queue: q) }
            if let audioIn, let audioOut {
                let aq = DispatchQueue(label: "transcode.audio")
                group.addTask { await Self.pump(input: audioIn, output: audioOut, queue: aq) }
            }
        }

        if reader.status == .failed { throw reader.error ?? TranscodeError.readerFailed }
        await writer.finishWriting()
        if writer.status != .completed { throw writer.error ?? TranscodeError.writerFailed }
    }

    private static func pump(input: AVAssetWriterInput, output: AVAssetReaderTrackOutput, queue: DispatchQueue) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            input.requestMediaDataWhenReady(on: queue) {
                while input.isReadyForMoreMediaData {
                    if let sample = output.copyNextSampleBuffer() {
                        input.append(sample)
                    } else {
                        input.markAsFinished()
                        cont.resume(); return
                    }
                }
            }
        }
    }

    /// Scale so the long edge ≤ maxLongEdge, keep aspect, round to even (HEVC).
    static func targetSize(width: CGFloat, height: CGFloat, maxLongEdge: CGFloat) -> (Int, Int) {
        let longEdge = max(width, height)
        let scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1
        func even(_ v: CGFloat) -> Int { let i = Int((v * scale).rounded()); return i - (i % 2) }
        return (max(2, even(width)), max(2, even(height)))
    }
}
