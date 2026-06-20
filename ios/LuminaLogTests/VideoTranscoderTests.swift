import XCTest
import AVFoundation
@testable import LuminaLog

final class VideoTranscoderTests: XCTestCase {

    /// Generates a tiny H.264 fixture so the test is hermetic.
    private func makeFixture(width: Int = 1920, height: Int = 1080, frames: Int = 12) async throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).mp4")
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width, AVVideoHeightKey: height,
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: nil)
        writer.add(input)
        writer.startWriting(); writer.startSession(atSourceTime: .zero)
        for i in 0..<frames {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 1_000_000) }
            var pb: CVPixelBuffer?
            CVPixelBufferCreate(nil, width, height, kCVPixelFormatType_32ARGB, nil, &pb)
            adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: 12))
        }
        input.markAsFinished()
        await writer.finishWriting()
        return url
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
        do { try await VideoTranscoder().transcode(source: bogus, to: dst); XCTFail("expected throw") }
        catch { /* expected */ }
    }
}
