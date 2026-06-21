import Foundation
import AVFoundation
import os.lock

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
        // A damaged / non-video file fails to load its tracks; treat that the same as
        // "no video track" so callers get a stable TranscodeError rather than a raw
        // AVFoundation error.
        guard let videoTrack = (try? await asset.loadTracks(withMediaType: .video))?.first else {
            throw TranscodeError.noVideoTrack
        }
        try? FileManager.default.removeItem(at: destination)

        let reader = try AVAssetReader(asset: asset)
        let writer = try AVAssetWriter(outputURL: destination, fileType: .mp4)

        // On any failure after reader/writer exist, cancel both (guarded by status so we
        // never cancel an already-completed writer/reader) and remove the partial output
        // file so downstream code never mistakes a corrupt half-write for a success.
        func cleanup() {
            if writer.status == .writing { writer.cancelWriting() }
            if reader.status == .reading { reader.cancelReading() }
            try? FileManager.default.removeItem(at: destination)
        }

        do {
            let natural = try await videoTrack.load(.naturalSize)
            let transform = (try? await videoTrack.load(.preferredTransform)) ?? .identity
            // Size the OUTPUT pixel box from the source's NATURAL (decoded-buffer) dimensions, NOT the
            // display-oriented dimensions: AVAssetReaderTrackOutput delivers raw buffers in the natural
            // orientation, so the writer box must match THAT aspect or the encoder stretches each frame.
            // videoIn.transform carries the source's preferredTransform so playback still rotates to the
            // correct display orientation (e.g. portrait). The long-edge magnitude is rotation-invariant,
            // so the size cap is unchanged.
            let (w, h) = Self.targetSize(width: abs(natural.width), height: abs(natural.height),
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
                    // Match the source's channel layout + sample rate so we don't upmix
                    // mono to stereo or resample 48 kHz down to 44.1 kHz.
                    let (channels, sampleRate) = await Self.audioChannelsAndRate(of: audioTrack)
                    let aIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [
                        AVFormatIDKey: kAudioFormatMPEG4AAC,
                        AVNumberOfChannelsKey: channels,
                        AVSampleRateKey: sampleRate,
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
                // Each pump owns its input/output exclusively and only ever touches them
                // on its own dedicated serial queue, so the per-pump confinement makes
                // these AV objects safe to capture despite not being Sendable. We never
                // share a queue across pumps.
                nonisolated(unsafe) let vIn = videoIn
                nonisolated(unsafe) let vOut = videoOut
                let q = DispatchQueue(label: "transcode.video")
                group.addTask { await Self.pump(input: vIn, output: vOut, queue: q) }
                if let audioIn, let audioOut {
                    nonisolated(unsafe) let aIn = audioIn
                    nonisolated(unsafe) let aOut = audioOut
                    let aq = DispatchQueue(label: "transcode.audio")
                    group.addTask { await Self.pump(input: aIn, output: aOut, queue: aq) }
                }
            }

            if reader.status == .failed {
                let err = reader.error ?? TranscodeError.readerFailed
                cleanup(); throw err
            }
            await writer.finishWriting()
            if writer.status != .completed {
                let err = writer.error ?? TranscodeError.writerFailed
                cleanup(); throw err
            }
        } catch {
            cleanup()
            throw error
        }
    }

    /// Reads the source audio track's stream format to recover its channel count and
    /// sample rate, falling back to stereo / 44.1 kHz when unavailable.
    private static func audioChannelsAndRate(of track: AVAssetTrack) async -> (channels: Int, sampleRate: Double) {
        guard let formats = try? await track.load(.formatDescriptions),
              let format = formats.first,
              let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(format) else {
            return (2, 44_100)
        }
        let channels = asbd.pointee.mChannelsPerFrame
        let rate = asbd.pointee.mSampleRate
        return (channels > 0 ? Int(channels) : 2, rate > 0 ? rate : 44_100)
    }

    private static func pump(input: AVAssetWriterInput, output: AVAssetReaderTrackOutput, queue: DispatchQueue) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            // This pump exclusively owns `input`/`output` and only ever touches them on
            // its own dedicated serial `queue` (never shared with the other pump), so the
            // confinement makes these non-Sendable AV objects safe to capture in the
            // @Sendable requestMediaDataWhenReady callback.
            nonisolated(unsafe) let input = input
            nonisolated(unsafe) let output = output
            // requestMediaDataWhenReady's callback can be re-invoked after we finish, so
            // guard the continuation to resume exactly once (double-resume is a fatal trap).
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

    /// Scale so the long edge ≤ maxLongEdge, keep aspect, round to even (HEVC).
    static func targetSize(width: CGFloat, height: CGFloat, maxLongEdge: CGFloat) -> (Int, Int) {
        let longEdge = max(width, height)
        let scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1
        func even(_ v: CGFloat) -> Int { let i = Int((v * scale).rounded()); return i - (i % 2) }
        return (max(2, even(width)), max(2, even(height)))
    }
}
