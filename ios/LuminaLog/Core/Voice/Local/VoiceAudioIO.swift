import AVFoundation
import Foundation
import OSLog

/// Microphone in, speaker out, for a local voice call.
///
/// One `AVAudioEngine` with Apple's voice processing enabled on the input node,
/// which gives echo cancellation, gain control and noise suppression: the
/// microphone does not hear the assistant's own voice, so the user can interrupt
/// it on speakerphone. Capture is delivered as 16 kHz mono Float32 (what the VAD
/// and speech-to-text models take); playback takes 24 kHz mono Float32 (what the
/// text-to-speech models produce).
final class VoiceAudioIO: @unchecked Sendable {

    static let captureSampleRate: Double = 16_000
    static let playbackSampleRate: Double = 24_000

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "voice-audio")

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let captureFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: VoiceAudioIO.captureSampleRate, channels: 1, interleaved: false
    )!
    private let playbackFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: VoiceAudioIO.playbackSampleRate, channels: 1, interleaved: false
    )!

    private let lock = NSLock()
    private var continuation: AsyncStream<[Float]>.Continuation?
    private var converter: AVAudioConverter?
    private var observers: [NSObjectProtocol] = []
    private var running = false
    private var attached = false

    /// Called (on an arbitrary queue) when the system takes the audio session
    /// away, for example an incoming phone call.
    var onInterruption: (@Sendable () -> Void)?

    /// 16 kHz mono microphone chunks. Call once per `start()`.
    func microphone() -> AsyncStream<[Float]> {
        AsyncStream(bufferingPolicy: .bufferingNewest(64)) { continuation in
            lock.lock()
            self.continuation = continuation
            lock.unlock()
        }
    }

    func start() throws {
        let session = AVAudioSession.sharedInstance()
        // `.voiceChat` selects the voice-processing route and allows Bluetooth
        // headsets; `.defaultToSpeaker` keeps a hands-free call on the loudspeaker.
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker])
        try session.setActive(true)

        // Must be set before the engine starts and before formats are read.
        try engine.inputNode.setVoiceProcessingEnabled(true)

        if !attached {
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: playbackFormat)
            attached = true
        }
        try installTapAndStart()
        running = true

        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil
        ) { [weak self] _ in
            // A route change (headphones in or out) stops the engine and can change
            // the input format: rebuild the tap and converter, then restart.
            guard let self, self.running else { return }
            Self.logger.log("audio configuration changed, restarting engine")
            do { try self.installTapAndStart() } catch {
                Self.logger.error("engine restart failed: \(error.localizedDescription, privacy: .public)")
                self.onInterruption?()
            }
        })
        observers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification, object: session, queue: nil
        ) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
            self?.onInterruption?()
        })
    }

    func stop() {
        running = false
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers.removeAll()
        engine.inputNode.removeTap(onBus: 0)
        player.stop()
        engine.stop()
        lock.lock()
        continuation?.finish()
        continuation = nil
        lock.unlock()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func setMuted(_ muted: Bool) {
        engine.inputNode.isVoiceProcessingInputMuted = muted
    }

    /// Plays 24 kHz mono samples and returns when they have been heard, or as
    /// soon as `stopPlayback()` cuts them off.
    func play(_ samples: [Float]) async {
        guard running, !samples.isEmpty,
              let buffer = AVAudioPCMBuffer(pcmFormat: playbackFormat, frameCapacity: AVAudioFrameCount(samples.count)),
              let channel = buffer.floatChannelData?[0] else { return }
        samples.withUnsafeBufferPointer { source in
            channel.update(from: source.baseAddress!, count: samples.count)
        }
        buffer.frameLength = AVAudioFrameCount(samples.count)
        if !player.isPlaying { player.play() }
        _ = await player.scheduleBuffer(buffer, at: nil, options: [], completionCallbackType: .dataPlayedBack)
    }

    /// Cuts the assistant off mid-sentence. Pending `play` calls return at once.
    func stopPlayback() {
        guard running else { return }
        player.stop()
        player.play()
    }

    // MARK: - Capture

    private func installTapAndStart() throws {
        let input = engine.inputNode
        input.removeTap(onBus: 0)
        let inputFormat = input.outputFormat(forBus: 0)
        guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0,
              let converter = AVAudioConverter(from: inputFormat, to: captureFormat) else {
            throw VoiceCallError.callConfigFailed("The microphone isn't available.")
        }
        // Voice processing can expose several input channels; the first is the
        // echo-cancelled voice.
        if inputFormat.channelCount > 1 { converter.channelMap = [0] }
        lock.lock()
        self.converter = converter
        lock.unlock()

        input.installTap(onBus: 0, bufferSize: 2048, format: inputFormat) { [weak self] buffer, _ in
            self?.deliver(buffer)
        }
        engine.prepare()
        try engine.start()
        player.play()
    }

    private func deliver(_ buffer: AVAudioPCMBuffer) {
        lock.lock()
        let converter = self.converter
        let continuation = self.continuation
        lock.unlock()
        guard let converter, let continuation, buffer.frameLength > 0 else { return }

        let ratio = captureFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 32
        guard let output = AVAudioPCMBuffer(pcmFormat: captureFormat, frameCapacity: capacity) else { return }

        var consumed = false
        var conversionError: NSError?
        converter.convert(to: output, error: &conversionError) { _, status in
            if consumed {
                status.pointee = .noDataNow
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return buffer
        }
        guard conversionError == nil, output.frameLength > 0, let channel = output.floatChannelData?[0] else { return }
        continuation.yield(Array(UnsafeBufferPointer(start: channel, count: Int(output.frameLength))))
    }
}
