import AVFoundation
import XCTest
@testable import LuminaLog

final class RecordingMergerTests: XCTestCase {

    private var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("merge-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    /// Writes `seconds` of silent AAC-in-CAF to `url` (a real, loadable asset).
    private func writeSilentCAF(seconds: Double, to url: URL) throws {
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        let file = try AVAudioFile(forWriting: url, settings: settings)
        let frames = AVAudioFrameCount(seconds * 44_100)
        let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: frames)!
        buffer.frameLength = frames   // zero-filled = silence
        try file.write(from: buffer)
    }

    func testDurationMeasuresRealAsset() async throws {
        let url = dir.appendingPathComponent("a.caf")
        try writeSilentCAF(seconds: 1.0, to: url)
        let d = await RecordingMerger().duration(of: url)
        XCTAssertEqual(d, 1.0, accuracy: 0.2)
    }

    func testDurationOfUnreadableFileIsZero() async {
        let bad = dir.appendingPathComponent("bad.caf")
        try? Data("not audio".utf8).write(to: bad)
        let d = await RecordingMerger().duration(of: bad)
        XCTAssertEqual(d, 0, accuracy: 0.0001)
    }

    func testMergeConcatenatesDurationsInOrder() async throws {
        let a = dir.appendingPathComponent("a.caf")
        let b = dir.appendingPathComponent("b.caf")
        try writeSilentCAF(seconds: 1.0, to: a)
        try writeSilentCAF(seconds: 2.0, to: b)
        let out = dir.appendingPathComponent("merged.m4a")

        try await RecordingMerger().merge([a, b], to: out)

        XCTAssertTrue(FileManager.default.fileExists(atPath: out.path))
        let d = await RecordingMerger().duration(of: out)
        XCTAssertEqual(d, 3.0, accuracy: 0.4)
    }

    func testMergeSkipsUnreadableTailSegment() async throws {
        let a = dir.appendingPathComponent("a.caf")
        try writeSilentCAF(seconds: 1.0, to: a)
        let garbage = dir.appendingPathComponent("z.caf")
        try Data(repeating: 0, count: 32).write(to: garbage)
        let out = dir.appendingPathComponent("merged2.m4a")

        try await RecordingMerger().merge([a, garbage], to: out)

        let d = await RecordingMerger().duration(of: out)
        XCTAssertEqual(d, 1.0, accuracy: 0.3)
    }

    func testMergeWithNoReadableSegmentsThrows() async {
        let garbage = dir.appendingPathComponent("z.caf")
        try? Data(repeating: 0, count: 16).write(to: garbage)
        let out = dir.appendingPathComponent("empty.m4a")
        do {
            try await RecordingMerger().merge([garbage], to: out)
            XCTFail("expected merge to throw")
        } catch {
            // expected
        }
    }
}
