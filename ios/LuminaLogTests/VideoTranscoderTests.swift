import XCTest
import AVFoundation
@testable import LuminaLog

final class VideoTranscoderTests: XCTestCase {

    /// Generates a tiny H.264 fixture so the test is hermetic. When `withAudio` is set,
    /// also writes a short silent LPCM audio track so the two-pump path is exercised.
    private func makeFixture(width: Int = 1920, height: Int = 1080, frames: Int = 12,
                             withAudio: Bool = false,
                             transform: CGAffineTransform = .identity) async throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width, AVVideoHeightKey: height,
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: nil)
        writer.add(input)
        // Set after add(), before startWriting(): the track records this as its
        // preferredTransform, mimicking how iPhone records (landscape buffers + rotation).
        input.transform = transform

        let sampleRate = 44_100.0
        var audioInput: AVAssetWriterInput?
        if withAudio {
            let aSettings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVNumberOfChannelsKey: 1,
                AVSampleRateKey: sampleRate,
                AVEncoderBitRateKey: 64_000,
            ]
            let aInput = AVAssetWriterInput(mediaType: .audio, outputSettings: aSettings)
            aInput.expectsMediaDataInRealTime = false
            writer.add(aInput)
            audioInput = aInput
        }

        writer.startWriting(); writer.startSession(atSourceTime: .zero)
        for i in 0..<frames {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 1_000_000) }
            var pb: CVPixelBuffer?
            CVPixelBufferCreate(nil, width, height, kCVPixelFormatType_32ARGB, nil, &pb)
            adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: 12))
        }
        input.markAsFinished()

        if let audioInput {
            try appendSilentAudio(to: audioInput, sampleRate: sampleRate, seconds: 1.0)
            audioInput.markAsFinished()
        }

        await writer.finishWriting()
        return url
    }

    /// Appends a single silent mono LPCM buffer; the writer transcodes it to AAC.
    /// CoreMedia owns and zero-fills the backing block so there is no use-after-free.
    private func appendSilentAudio(to input: AVAssetWriterInput, sampleRate: Double, seconds: Double) throws {
        let frameCount = Int(sampleRate * seconds)
        let byteCount = frameCount * 2  // 16-bit mono
        var asbd = AudioStreamBasicDescription(
            mSampleRate: sampleRate,
            mFormatID: kAudioFormatLinearPCM,
            mFormatFlags: kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked,
            mBytesPerPacket: 2, mFramesPerPacket: 1, mBytesPerFrame: 2,
            mChannelsPerFrame: 1, mBitsPerChannel: 16, mReserved: 0)

        var formatDesc: CMAudioFormatDescription?
        guard CMAudioFormatDescriptionCreate(allocator: kCFAllocatorDefault, asbd: &asbd,
                                             layoutSize: 0, layout: nil, magicCookieSize: 0,
                                             magicCookie: nil, extensions: nil,
                                             formatDescriptionOut: &formatDesc) == noErr,
              let formatDesc else { throw NSError(domain: "test", code: 1) }

        // memoryBlock: nil + blockAllocator: default → CoreMedia allocates and owns the
        // backing store, so its lifetime is tied to the block buffer (no dangling Data).
        var blockBuffer: CMBlockBuffer?
        guard CMBlockBufferCreateWithMemoryBlock(allocator: kCFAllocatorDefault,
                                                 memoryBlock: nil, blockLength: byteCount,
                                                 blockAllocator: kCFAllocatorDefault,
                                                 customBlockSource: nil, offsetToData: 0,
                                                 dataLength: byteCount, flags: kCMBlockBufferAssureMemoryNowFlag,
                                                 blockBufferOut: &blockBuffer) == noErr,
              let blockBuffer else { throw NSError(domain: "test", code: 2) }
        // Zero the block → silence (freshly allocated memory is not guaranteed zeroed).
        let zeros = [UInt8](repeating: 0, count: byteCount)
        CMBlockBufferReplaceDataBytes(with: zeros, blockBuffer: blockBuffer,
                                      offsetIntoDestination: 0, dataLength: byteCount)

        var sampleBuffer: CMSampleBuffer?
        var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: CMTimeScale(sampleRate)),
                                        presentationTimeStamp: .zero, decodeTimeStamp: .invalid)
        guard CMSampleBufferCreateReady(allocator: kCFAllocatorDefault, dataBuffer: blockBuffer,
                                        formatDescription: formatDesc, sampleCount: frameCount,
                                        sampleTimingEntryCount: 1, sampleTimingArray: &timing,
                                        sampleSizeEntryCount: 0, sampleSizeArray: nil,
                                        sampleBufferOut: &sampleBuffer) == noErr,
              let sampleBuffer else { throw NSError(domain: "test", code: 3) }

        if !input.append(sampleBuffer) { throw NSError(domain: "test", code: 4) }
    }

    func testTranscodeProducesHEVC720p() async throws {
        let src = try await makeFixture(width: 1920, height: 1080)
        let dst = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        defer { try? FileManager.default.removeItem(at: src); try? FileManager.default.removeItem(at: dst) }

        try await VideoTranscoder().transcode(source: src, to: dst)

        let asset = AVURLAsset(url: dst)
        let track = try await asset.loadTracks(withMediaType: .video).first
        let size = try await track!.load(.naturalSize)
        XCTAssertLessThanOrEqual(max(size.width, size.height), 1281, "Long edge capped at ~1280")
        let formats = try await track!.load(.formatDescriptions)
        let codec = CMFormatDescriptionGetMediaSubType(formats.first!)
        XCTAssertEqual(codec, kCMVideoCodecType_HEVC)
    }

    func testTranscodeThrowsOnNonVideo() async throws {
        let bogus = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        try Data([0,1,2,3]).write(to: bogus)
        defer { try? FileManager.default.removeItem(at: bogus) }
        let dst = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        do {
            try await VideoTranscoder().transcode(source: bogus, to: dst)
            XCTFail("expected throw")
        } catch {
            XCTAssertTrue(error is VideoTranscoder.TranscodeError, "expected a TranscodeError, got \(error)")
        }
    }

    func testPortraitOrientationPreserved() async throws {
        let src = try await makeFixture(width: 1080, height: 1920)
        let dst = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        defer { try? FileManager.default.removeItem(at: src); try? FileManager.default.removeItem(at: dst) }

        try await VideoTranscoder().transcode(source: src, to: dst)

        let asset = AVURLAsset(url: dst)
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let natural = try await track.load(.naturalSize)
        let transform = try await track.load(.preferredTransform)
        let oriented = natural.applying(transform)
        let longEdge = max(abs(oriented.width), abs(oriented.height))
        let shortEdge = min(abs(oriented.width), abs(oriented.height))
        XCTAssertLessThanOrEqual(longEdge, 1281, "Long edge capped at ~1280")
        XCTAssertEqual(shortEdge, 720, accuracy: 2, "Short edge of 1080x1920 → ~720 wide")
    }

    func testRotatedSourcePreservesAspectRatio() async throws {
        // iPhone-style portrait recording: 1920x1080 LANDSCAPE buffers + a 90° rotation transform.
        let src = try await makeFixture(width: 1920, height: 1080, transform: CGAffineTransform(rotationAngle: .pi / 2))
        let dst = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        defer { try? FileManager.default.removeItem(at: src); try? FileManager.default.removeItem(at: dst) }

        try await VideoTranscoder().transcode(source: src, to: dst)

        let track = try await AVURLAsset(url: dst).loadTracks(withMediaType: .video).first!
        let outNatural = try await track.load(.naturalSize)
        // The encoded pixel box must keep the SOURCE buffer aspect (16:9 ≈ 1.778), NOT be squished into 9:16 (≈0.5625).
        let outAspect = abs(outNatural.width) / abs(outNatural.height)
        XCTAssertEqual(outAspect, 1920.0 / 1080.0, accuracy: 0.06, "output pixel box must keep source aspect (no stretch)")
        // And the DISPLAY orientation must still be portrait via the carried transform, capped at ~720p.
        let outTransform = try await track.load(.preferredTransform)
        let displayed = outNatural.applying(outTransform)
        XCTAssertGreaterThan(abs(displayed.height), abs(displayed.width), "must still display as portrait")
        XCTAssertLessThanOrEqual(max(abs(displayed.width), abs(displayed.height)), 1281)
    }

    func testShouldTranscode() async throws {
        let big = try await makeFixture(width: 1920, height: 1080, frames: 2)
        let small = try await makeFixture(width: 640, height: 480, frames: 2)
        defer { try? FileManager.default.removeItem(at: big); try? FileManager.default.removeItem(at: small) }

        let shouldBig = await VideoTranscoder().shouldTranscode(source: big)
        let shouldSmall = await VideoTranscoder().shouldTranscode(source: small)
        XCTAssertTrue(shouldBig, "1920x1080 exceeds the 1280 long edge")
        XCTAssertFalse(shouldSmall, "640x480 is below the 1280 long edge")
    }

    func testTranscodeWithAudioTrack() async throws {
        let src = try await makeFixture(width: 1280, height: 720, frames: 12, withAudio: true)
        let dst = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        defer { try? FileManager.default.removeItem(at: src); try? FileManager.default.removeItem(at: dst) }

        try await VideoTranscoder().transcode(source: src, to: dst)

        let asset = AVURLAsset(url: dst)
        let videoTrack = try await asset.loadTracks(withMediaType: .video).first
        XCTAssertNotNil(videoTrack, "video track must survive transcode")

        let audioTracks = try await asset.loadTracks(withMediaType: .audio)
        XCTAssertEqual(audioTracks.count, 1, "output should carry one audio track")
        let formats = try await audioTracks.first!.load(.formatDescriptions)
        let subtype = CMFormatDescriptionGetMediaSubType(formats.first!)
        XCTAssertEqual(subtype, kAudioFormatMPEG4AAC, "audio re-encoded to AAC")
    }
}
