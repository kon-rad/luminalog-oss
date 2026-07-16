import AVFoundation
import Foundation
import os

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

    /// Set when a phone call / alarm / backgrounding cut a recording short and we
    /// finalized the partial clip. The view observes this to attach the audio to
    /// the current entry, then resets it to `nil`.
    @Published private(set) var interruptionSavedAudio: AudioAttachment?

    /// Max number of samples retained in `levels` (waveform bar count).
    static let maxLevelSamples = 50

    /// dBFS value mapped to 0 (silence floor). 0 dBFS maps to 1.
    static let meterFloorDB: Float = -50

    /// Partials shorter than this (seconds) are discarded rather than attached —
    /// an interruption right after tapping record shouldn't leave an empty clip.
    static let minInterruptedDuration: TimeInterval = 0.3

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var interruptionObserver: NSObjectProtocol?

    private static let logger = Logger(subsystem: "LuminaLog", category: "AudioRecorder")

    deinit {
        // Best-effort cleanup only — the real teardown path removes the observer
        // in `finalize()`/`cancel()`. (Swift 5: stored-property access from deinit
        // is permitted on a @MainActor class.)
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
        }
    }

    /// DIAGNOSTIC: logs the input the OS actually selected vs. every input it
    /// makes available, so we can tell whether a headset mic is being passed
    /// over (selectable, fixable via setPreferredInput) or simply not offered
    /// (hardware/adapter issue — no code fix possible).
    private static func logInputs(_ session: AVAudioSession, _ context: String) {
        let describe: (AVAudioSessionPortDescription) -> String = {
            "\($0.portName) [\($0.portType.rawValue)]"
        }
        let selected = session.currentRoute.inputs.map(describe)
        let available = (session.availableInputs ?? []).map(describe)
        logger.notice("🎤 [\(context, privacy: .public)] selected input(s): \(selected, privacy: .public)")
        logger.notice("🎤 [\(context, privacy: .public)] available inputs: \(available, privacy: .public)")
    }

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
            Self.logInputs(session, "AudioRecorder")

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
            interruptionSavedAudio = nil
            elapsed = 0
            levels = []
            observeInterruptions()
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

    /// Phone call / alarm / Siri taking the audio session: finalize the partial
    /// so it isn't lost, rather than letting the recorder stall silently.
    private func observeInterruptions() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            guard
                let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                AVAudioSession.InterruptionType(rawValue: raw) == .began
            else { return }
            MainActor.assumeIsolated {
                self?.finalizeInterrupted()
            }
        }
    }

    /// Stops recording and returns the finished attachment (nil when nothing
    /// was being recorded).
    func stop() -> AudioAttachment? {
        finalize()
    }

    /// Finalizes an in-flight recording cut short by an interruption (call/alarm)
    /// or by backgrounding, and publishes the partial so the entry can attach it.
    /// Idempotent: a no-op when nothing is recording — safe if both the
    /// interruption notification and the scenePhase backstop fire.
    func finalizeInterrupted() {
        guard let audio = finalize() else { return }
        guard audio.durationSec >= Self.minInterruptedDuration else {
            try? FileManager.default.removeItem(at: audio.url)
            return
        }
        interruptionSavedAudio = audio
    }

    /// Resets the published partial after the view has attached it.
    func clearInterruptionSavedAudio() {
        interruptionSavedAudio = nil
    }

    /// Stops the recorder and returns the finished attachment (nil when nothing
    /// was being recorded), clearing transient state and the session.
    private func finalize() -> AudioAttachment? {
        guard let recorder, isRecording else { return nil }
        let duration = recorder.currentTime
        let url = recorder.url
        recorder.stop()
        teardown()
        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
        return AudioAttachment(url: url, durationSec: duration)
    }

    /// Stops and discards the in-flight recording (e.g. on view dismissal).
    func cancel() {
        guard let recorder else { return }
        let url = recorder.url
        recorder.stop()
        teardown()
        try? FileManager.default.removeItem(at: url)
        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Clears recorder/timer/state and removes the interruption observer. Shared
    /// by `finalize()` and `cancel()`; does not touch the audio session.
    private func teardown() {
        timer?.invalidate()
        timer = nil
        recorder = nil
        isRecording = false
        RecordingState.shared.setRecording(false)
        elapsed = 0
        levels = []
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
            self.interruptionObserver = nil
        }
    }
}
