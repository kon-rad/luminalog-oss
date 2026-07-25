import AVFoundation
import Foundation
import os

/// Captures microphone audio into a single AAC-in-CAF segment file using
/// `AVAudioEngine`. Each buffer write hits disk, so a crash leaves a CAF that is
/// still readable up to the last written buffer (unlike an unstopped `.m4a`).
/// One instance records one segment at a time; `RecordingSession` drives the
/// begin/end lifecycle across segments.
@MainActor
protocol SegmentRecording: AnyObject {
    var currentSegmentTime: TimeInterval { get }
    var levels: [CGFloat] { get }
    var isActive: Bool { get }
    /// Requests mic permission (first call), activates the audio session, and
    /// starts writing a new segment to `url`. Throws `SegmentRecorderError`.
    func begin(url: URL) async throws
    /// Stops the current segment and returns its file URL (nil if not active).
    func end() -> URL?
    /// Deactivates the shared audio session (call when pausing/stopping fully).
    func deactivateSession()
}

enum SegmentRecorderError: Error { case permissionDenied, sessionFailed, fileError }

@MainActor
final class SegmentRecorder: NSObject, SegmentRecording {

    static let meterFloorDB: Float = -50
    static let maxLevelSamples = 50

    private let engine = AVAudioEngine()
    private var file: AVAudioFile?
    private var segmentURL: URL?
    private var framesWritten: AVAudioFrameCount = 0
    private var sampleRate: Double = 44_100

    private(set) var levels: [CGFloat] = []
    private static let logger = Logger(subsystem: "LuminaLog", category: "SegmentRecorder")

    var isActive: Bool { file != nil }

    var currentSegmentTime: TimeInterval {
        sampleRate > 0 ? Double(framesWritten) / sampleRate : 0
    }

    /// Maps an `averagePower` dBFS reading to 0...1 (floor at `meterFloorDB`).
    static func normalize(power: Float) -> CGFloat {
        let clamped = max(meterFloorDB, min(0, power))
        return CGFloat((clamped - meterFloorDB) / -meterFloorDB)
    }

    func begin(url: URL) async throws {
        guard await AVAudioApplication.requestRecordPermission() else {
            throw SegmentRecorderError.permissionDenied
        }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, options: [.defaultToSpeaker])
            try session.setActive(true)
        } catch {
            throw SegmentRecorderError.sessionFailed
        }

        let input = engine.inputNode
        let format = input.inputFormat(forBus: 0)
        sampleRate = format.sampleRate > 0 ? format.sampleRate : 44_100
        framesWritten = 0
        levels = []

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: Int(format.channelCount),
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        let audioFile: AVAudioFile
        do {
            // Writing with the input's own processing format avoids a converter.
            audioFile = try AVAudioFile(forWriting: url, settings: settings,
                                        commonFormat: format.commonFormat,
                                        interleaved: format.isInterleaved)
        } catch {
            throw SegmentRecorderError.fileError
        }

        input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
            // Runs on AVAudioEngine's real-time audio thread — NOT the main actor.
            // Write synchronously here (the buffer is only valid during this call),
            // then hop the scalar bookkeeping to the main actor.
            do {
                try audioFile.write(from: buffer)
            } catch {
                Self.logger.error("segment write failed: \(error.localizedDescription, privacy: .public)")
            }
            let frames = buffer.frameLength
            let sample = Self.level(from: buffer)
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.framesWritten += frames
                self.appendLevelSample(sample)
            }
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            throw SegmentRecorderError.sessionFailed
        }
        self.file = audioFile
        self.segmentURL = url
    }

    func end() -> URL? {
        guard file != nil, let url = segmentURL else { return nil }
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
        file = nil                 // closing the AVAudioFile finalizes the CAF
        segmentURL = nil
        return url
    }

    func deactivateSession() {
        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Pure RMS→normalized level; safe on the audio thread (reads the live
    /// buffer and returns a scalar, so nothing retains the buffer past the tap).
    private static func level(from buffer: AVAudioPCMBuffer) -> CGFloat {
        guard let ch = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        let n = Int(buffer.frameLength)
        var sum: Float = 0
        for i in 0..<n { sum += ch[i] * ch[i] }
        let rms = sqrtf(sum / Float(n))
        let db = rms > 0 ? 20 * log10f(rms) : meterFloorDB
        return normalize(power: db)
    }

    /// Appends a precomputed level sample (main actor).
    private func appendLevelSample(_ sample: CGFloat) {
        levels.append(sample)
        if levels.count > Self.maxLevelSamples {
            levels.removeFirst(levels.count - Self.maxLevelSamples)
        }
    }
}
