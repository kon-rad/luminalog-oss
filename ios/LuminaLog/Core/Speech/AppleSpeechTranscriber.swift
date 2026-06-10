import AVFoundation
import Foundation
import OSLog
import Speech

/// `SpeechTranscriber` backed by Apple's Speech framework (spec §2.3).
///
/// Prefers on-device recognition (`requiresOnDeviceRecognition = true`) when
/// the recognizer supports it for the current locale; otherwise falls back to
/// network-based recognition (the OS prompt covers user consent).
@MainActor
final class AppleSpeechTranscriber: NSObject, SpeechTranscriber {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "speech")

    private let recognizer = SFSpeechRecognizer()
    private let audioEngine = AVAudioEngine()

    private var liveRequest: SFSpeechAudioBufferRecognitionRequest?
    private var liveTask: SFSpeechRecognitionTask?
    private var liveContinuation: AsyncThrowingStream<String, Error>.Continuation?

    var isAvailable: Bool {
        recognizer?.isAvailable ?? false
    }

    // MARK: - Authorization

    func requestAuthorization() async -> Bool {
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        guard speechStatus == .authorized else { return false }
        // Live dictation also needs the microphone; requesting here keeps the
        // permission flow in one place (no-op if already determined).
        return await AVAudioApplication.requestRecordPermission()
    }

    // MARK: - Live dictation

    func startLiveTranscription() -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
                continuation.finish(throwing: SpeechTranscriberError.notAuthorized)
                return
            }
            guard let recognizer, recognizer.isAvailable else {
                continuation.finish(throwing: SpeechTranscriberError.unavailable)
                return
            }

            // Tear down any forgotten previous session before starting anew.
            stopLiveTranscription()

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition {
                request.requiresOnDeviceRecognition = true
            }

            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(
                    .playAndRecord,
                    mode: .measurement,
                    options: [.duckOthers, .defaultToSpeaker]
                )
                try session.setActive(true, options: .notifyOthersOnDeactivation)

                let inputNode = audioEngine.inputNode
                let format = inputNode.outputFormat(forBus: 0)
                inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                    request.append(buffer)
                }
                audioEngine.prepare()
                try audioEngine.start()
            } catch {
                Self.logger.error("Audio engine start failed: \(error)")
                continuation.finish(throwing: SpeechTranscriberError.audioEngineFailed)
                return
            }

            liveRequest = request
            liveContinuation = continuation
            liveTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                if let result {
                    continuation.yield(result.bestTranscription.formattedString)
                    if result.isFinal {
                        Task { @MainActor in self?.endLiveSession(error: nil) }
                    }
                } else if let error {
                    Task { @MainActor in self?.endLiveSession(error: error) }
                }
            }
        }
    }

    func stopLiveTranscription() {
        endLiveSession(error: nil)
    }

    /// Stops the engine and finishes the stream exactly once. Errors arriving
    /// after a deliberate stop (e.g. the task's cancellation error) are
    /// ignored because the continuation is already cleared.
    private func endLiveSession(error: Error?) {
        guard liveContinuation != nil || liveTask != nil else { return }

        if audioEngine.isRunning {
            audioEngine.stop()
        }
        audioEngine.inputNode.removeTap(onBus: 0)
        liveRequest?.endAudio()
        liveTask?.cancel()
        liveTask = nil
        liveRequest = nil

        if let continuation = liveContinuation {
            liveContinuation = nil
            if let error {
                Self.logger.error("Live recognition failed: \(error)")
                continuation.finish(throwing: SpeechTranscriberError.recognitionFailed)
            } else {
                continuation.finish()
            }
        }

        try? AVAudioSession.sharedInstance()
            .setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: - File transcription

    func transcribeFile(url: URL) async throws -> String {
        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            throw SpeechTranscriberError.notAuthorized
        }
        guard let recognizer, recognizer.isAvailable else {
            throw SpeechTranscriberError.unavailable
        }

        let request = SFSpeechURLRecognitionRequest(url: url)
        request.shouldReportPartialResults = false
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        let guard_ = ResumeGuard()
        return try await withCheckedThrowingContinuation { continuation in
            recognizer.recognitionTask(with: request) { result, error in
                if let error {
                    if guard_.claim() {
                        Self.logger.error("File recognition failed: \(error)")
                        continuation.resume(throwing: SpeechTranscriberError.recognitionFailed)
                    }
                    return
                }
                guard let result, result.isFinal else { return }
                if guard_.claim() {
                    continuation.resume(returning: result.bestTranscription.formattedString)
                }
            }
        }
    }
}

/// Thread-safe once-only latch so a recognition callback can never resume a
/// continuation twice (Speech may report an error after the final result).
private final class ResumeGuard: @unchecked Sendable {
    private let lock = NSLock()
    private var claimed = false

    /// Returns true exactly once.
    func claim() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !claimed else { return false }
        claimed = true
        return true
    }
}
