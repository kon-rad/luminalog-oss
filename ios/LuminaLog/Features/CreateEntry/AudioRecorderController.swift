import AVFoundation
import Foundation

/// Owns the AVAudioRecorder for voice-entry capture (design §5 media row):
/// records mono AAC `.m4a` into a temp file and publishes elapsed time.
@MainActor
final class AudioRecorderController: NSObject, ObservableObject {

    @Published private(set) var isRecording = false
    @Published private(set) var elapsed: TimeInterval = 0
    /// Set when the microphone permission is denied (view shows a Settings alert).
    @Published var permissionDenied = false

    /// Rolling buffer of normalized mic power (0...1), newest last, for the waveform.
    @Published private(set) var levels: [CGFloat] = []

    /// Max number of samples retained in `levels` (waveform bar count).
    static let maxLevelSamples = 50

    /// dBFS value mapped to 0 (silence floor). 0 dBFS maps to 1.
    static let meterFloorDB: Float = -50

    private var recorder: AVAudioRecorder?
    private var timer: Timer?

    var elapsedLabel: String {
        let seconds = Int(elapsed)
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    /// Normalizes an `averagePower` dBFS reading to 0...1 and appends it to the
    /// rolling `levels` buffer, trimming to `maxLevelSamples`.
    func appendMeterSample(power: Float) {
        let clampedDB = max(Self.meterFloorDB, min(0, power))
        let normalized = CGFloat((clampedDB - Self.meterFloorDB) / -Self.meterFloorDB)
        levels.append(normalized)
        if levels.count > Self.maxLevelSamples {
            levels.removeFirst(levels.count - Self.maxLevelSamples)
        }
    }

    /// Requests mic permission and starts recording. Returns false when
    /// permission is denied or the recorder can't start.
    @discardableResult
    func start() async -> Bool {
        guard !isRecording else { return false }
        guard await AVAudioApplication.requestRecordPermission() else {
            permissionDenied = true
            return false
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, options: [.defaultToSpeaker])
            try session.setActive(true)

            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("\(UUID().uuidString).m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ]
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.isMeteringEnabled = true
            guard recorder.record() else {
                deactivateSession()
                return false
            }

            self.recorder = recorder
            isRecording = true
            RecordingState.shared.setRecording(true)
            elapsed = 0
            levels = []
            timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self, let recorder = self.recorder else { return }
                    self.elapsed = recorder.currentTime
                    recorder.updateMeters()
                    self.appendMeterSample(power: recorder.averagePower(forChannel: 0))
                }
            }
            return true
        } catch {
            // Don't hold the activated session when the start failed.
            deactivateSession()
            return false
        }
    }

    private func deactivateSession() {
        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Stops recording and returns the finished attachment (nil when nothing
    /// was being recorded).
    func stop() -> AudioAttachment? {
        guard let recorder, isRecording else { return nil }
        let duration = recorder.currentTime
        recorder.stop()
        timer?.invalidate()
        timer = nil
        self.recorder = nil
        isRecording = false
        RecordingState.shared.setRecording(false)
        elapsed = 0
        levels = []
        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
        return AudioAttachment(url: recorder.url, durationSec: duration)
    }

    /// Stops and discards the in-flight recording (e.g. on view dismissal).
    func cancel() {
        guard let recorder else { return }
        let url = recorder.url
        recorder.stop()
        timer?.invalidate()
        timer = nil
        self.recorder = nil
        isRecording = false
        RecordingState.shared.setRecording(false)
        elapsed = 0
        levels = []
        try? FileManager.default.removeItem(at: url)
        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
    }
}
