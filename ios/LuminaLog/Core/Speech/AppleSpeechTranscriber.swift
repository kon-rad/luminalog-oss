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

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "speech")

    private let recognizer = SFSpeechRecognizer()
    private let audioEngine = AVAudioEngine()

    private var liveRequest: SFSpeechAudioBufferRecognitionRequest?
    private var liveTask: SFSpeechRecognitionTask?
    private var liveContinuation: AsyncThrowingStream<String, Error>.Continuation?
    /// Tracks whether the input-node tap is installed so teardown can always
    /// remove it (installing a second tap on bus 0 raises an NSException).
    private var tapInstalled = false

    /// File transcription is abandoned (with `.recognitionFailed`) after this
    /// long so a stuck recognizer can't hang the save pipeline forever.
    private static let fileTranscriptionTimeout: TimeInterval = 120

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
                tapInstalled = true
                audioEngine.prepare()
                try audioEngine.start()
            } catch {
                Self.logger.error("Audio engine start failed: \(error)")
                // Fully unwind partial setup (tap/engine/session) so the next
                // dictation attempt can install its tap cleanly.
                teardownAudio()
                continuation.finish(throwing: SpeechTranscriberError.audioEngineFailed)
                return
            }

            liveRequest = request
            liveContinuation = continuation
            // If the consumer cancels or abandons the stream, tear the whole
            // session down so the microphone isn't left hot.
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in self?.endLiveSession(error: nil) }
            }
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

    /// Stops the engine and finishes the stream exactly once. Idempotent and
    /// robust to partial setup, so it is safe from the failure path, stream
    /// termination, and repeated stop calls. Errors arriving after a
    /// deliberate stop (e.g. the task's cancellation error) are ignored
    /// because the continuation is already cleared.
    private func endLiveSession(error: Error?) {
        guard liveContinuation != nil || liveTask != nil || tapInstalled else { return }

        teardownAudio()
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
    }

    /// Stops the engine, removes the tap (only when installed), and releases
    /// the audio session. Safe to call at any point of partial setup.
    private func teardownAudio() {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
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

        // Race recognition against a timeout; whichever loses is cancelled.
        // A timeout throws `.recognitionFailed`, which the save pipeline
        // degrades to a `.failed` transcript status (the entry still saves).
        return try await withThrowingTaskGroup(of: String.self) { group in
            group.addTask { @MainActor in
                try await Self.runRecognition(recognizer: recognizer, request: request)
            }
            let timeout = Self.fileTranscriptionTimeout
            let logger = Self.logger
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                logger.error("File recognition timed out after \(timeout)s")
                throw SpeechTranscriberError.recognitionFailed
            }
            defer { group.cancelAll() }
            guard let transcript = try await group.next() else {
                throw SpeechTranscriberError.recognitionFailed
            }
            return transcript
        }
    }

    /// Runs one file-recognition task, cancelling the underlying
    /// `SFSpeechRecognitionTask` when the surrounding Swift task is cancelled
    /// (Speech then reports an error, which resumes the continuation).
    @MainActor
    private static func runRecognition(
        recognizer: SFSpeechRecognizer,
        request: SFSpeechURLRecognitionRequest
    ) async throws -> String {
        let guard_ = ResumeGuard()
        let box = RecognitionTaskBox()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let task = recognizer.recognitionTask(with: request) { result, error in
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
                box.store(task)
            }
        } onCancel: {
            box.cancel()
        }
    }
}

/// Thread-safe holder for an `SFSpeechRecognitionTask` so a cancellation
/// handler (which may run before or after the task is created, on any thread)
/// can always cancel it exactly once.
private final class RecognitionTaskBox: @unchecked Sendable {
    private let lock = NSLock()
    private var task: SFSpeechRecognitionTask?
    private var cancelled = false

    func store(_ task: SFSpeechRecognitionTask) {
        lock.lock()
        self.task = task
        let shouldCancel = cancelled
        lock.unlock()
        if shouldCancel { task.cancel() }
    }

    func cancel() {
        lock.lock()
        cancelled = true
        let task = self.task
        lock.unlock()
        task?.cancel()
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
