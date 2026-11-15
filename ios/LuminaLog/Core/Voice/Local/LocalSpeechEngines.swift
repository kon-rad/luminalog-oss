import AVFoundation
import FluidAudio
import Foundation
import OSLog

/// Transcribes one finished utterance of 16 kHz mono audio, on device.
protocol VoiceSpeechToText: Sendable {
    func transcribe(_ samples: [Float]) async throws -> String
}

/// Synthesizes one sentence to 24 kHz mono Float32 samples, on device.
protocol VoiceTextToSpeech: Sendable {
    func synthesize(_ text: String) async throws -> [Float]
}

enum LocalSpeechError: LocalizedError {
    case notLoaded
    case synthesisFailed

    var errorDescription: String? {
        switch self {
        case .notLoaded: return "The on-device speech models aren't loaded yet."
        case .synthesisFailed: return "The on-device voice couldn't speak that."
        }
    }
}

// MARK: - Voice activity (Silero VAD, Core ML)

actor SileroFrameClassifier: VoiceFrameClassifying {
    private let manager: VadManager
    private var state: VadStreamState

    init(progress: ProgressHandler? = nil) async throws {
        let manager = try await VadManager(progressHandler: progress)
        self.manager = manager
        self.state = await manager.makeStreamState()
    }

    func probability(for frame: [Float]) async throws -> Float {
        let result = try await manager.processStreamingChunk(frame, state: state)
        state = result.state
        return result.probability
    }

    func reset() async {
        state = await manager.makeStreamState()
    }
}

// MARK: - Speech to text (Parakeet TDT 0.6B v3, Core ML on the Neural Engine)

actor ParakeetSpeechToText: VoiceSpeechToText {
    private let manager: AsrManager

    init(progress: ProgressHandler? = nil) async throws {
        let models = try await AsrModels.downloadAndLoad(version: .v3, progressHandler: progress)
        let manager = AsrManager(config: .default)
        try await manager.loadModels(models)
        self.manager = manager
    }

    func transcribe(_ samples: [Float]) async throws -> String {
        // The model rejects clips under about a second; pad a short "yes" with silence.
        var padded = samples
        let minimum = Int(VoiceAudioIO.captureSampleRate * 1.2)
        if padded.count < minimum {
            padded.append(contentsOf: [Float](repeating: 0, count: minimum - padded.count))
        }
        // A fresh decoder state per utterance: turns are independent clips.
        var decoderState = TdtDecoderState.make(decoderLayers: await manager.decoderLayerCount)
        let result = try await manager.transcribe(padded, decoderState: &decoderState)
        return result.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - Text to speech (Kokoro-82M, Core ML)

actor KokoroTextToSpeech: VoiceTextToSpeech {
    /// Kokoro's default English voice. One constant so the voice is easy to change.
    static let voice = "af_heart"

    private let manager: KokoroAneManager

    init() async throws {
        // `.aneTailCpu` keeps every stage off Metal. A call must survive the screen
        // locking, and Metal work from the background gets an iPhone app killed.
        let manager = KokoroAneManager(defaultVoice: Self.voice, computeUnits: .aneTailCpu, version: .legacy)
        try await manager.initialize()
        self.manager = manager
    }

    func synthesize(_ text: String) async throws -> [Float] {
        let result = try await manager.synthesizeDetailed(text: text, voice: Self.voice)
        guard !result.samples.isEmpty else { throw LocalSpeechError.synthesisFailed }
        return result.samples
    }
}

// MARK: - Text to speech floor (Apple system voice, zero download)

/// `AVSpeechSynthesizer` rendered to buffers instead of played directly, so it
/// goes through the same player as Kokoro: echo cancellation sees it and an
/// interruption can cut it off.
final class SystemTextToSpeech: NSObject, VoiceTextToSpeech, @unchecked Sendable {

    private let synthesizer = AVSpeechSynthesizer()
    private let target = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: VoiceAudioIO.playbackSampleRate, channels: 1, interleaved: false
    )!

    func synthesize(_ text: String) async throws -> [Float] {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: AVSpeechSynthesisVoice.currentLanguageCode())
        let target = self.target

        return try await withCheckedThrowingContinuation { continuation in
            let lock = NSLock()
            var samples: [Float] = []
            var converter: AVAudioConverter?
            var finished = false

            synthesizer.write(utterance) { buffer in
                lock.lock()
                defer { lock.unlock() }
                guard !finished else { return }
                guard let pcm = buffer as? AVAudioPCMBuffer, pcm.frameLength > 0 else {
                    // A zero-length buffer marks the end of the utterance.
                    finished = true
                    if samples.isEmpty {
                        continuation.resume(throwing: LocalSpeechError.synthesisFailed)
                    } else {
                        continuation.resume(returning: samples)
                    }
                    return
                }
                if converter == nil { converter = AVAudioConverter(from: pcm.format, to: target) }
                guard let converter else { return }
                let capacity = AVAudioFrameCount(Double(pcm.frameLength) * target.sampleRate / pcm.format.sampleRate) + 32
                guard let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
                var consumed = false
                var conversionError: NSError?
                converter.convert(to: output, error: &conversionError) { _, status in
                    if consumed {
                        status.pointee = .noDataNow
                        return nil
                    }
                    consumed = true
                    status.pointee = .haveData
                    return pcm
                }
                if conversionError == nil, output.frameLength > 0, let channel = output.floatChannelData?[0] {
                    samples.append(contentsOf: UnsafeBufferPointer(start: channel, count: Int(output.frameLength)))
                }
            }
        }
    }
}

// MARK: - Loading

/// The loaded on-device models for a call.
struct LocalVoiceEngineSet: Sendable {
    let classifier: VoiceFrameClassifying
    let speechToText: VoiceSpeechToText
    /// The neural voice, or nil when this device runs the system voice only.
    let neuralVoice: VoiceTextToSpeech?
    let systemVoice: VoiceTextToSpeech
}

protocol LocalVoiceEngineProviding: Sendable {
    /// Downloads (first use only) and loads the models. `status` receives short
    /// user-facing progress lines. Models stay loaded between calls.
    func prepare(status: @escaping @Sendable (String) -> Void) async throws -> LocalVoiceEngineSet
    /// Frees the models (memory pressure while no call is live).
    func unload() async
}

actor LocalVoiceEngines: LocalVoiceEngineProviding {

    static let shared = LocalVoiceEngines()

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "voice-engines")

    /// Kokoro peaks near 0.9 GB of memory on a Mac. Below 6 GB of device RAM
    /// (about 5.5 GB as reported) it is not worth the jetsam risk next to the
    /// speech-to-text model, so those phones use the system voice.
    static let neuralVoiceMinimumMemory: UInt64 = 5_500_000_000

    private var loaded: LocalVoiceEngineSet?

    func prepare(status: @escaping @Sendable (String) -> Void) async throws -> LocalVoiceEngineSet {
        if let loaded { return loaded }
        let started = Date()

        status("Preparing on-device speech…")
        let classifier = try await SileroFrameClassifier()

        let speechToText = try await ParakeetSpeechToText(progress: { progress in
            // Only meaningful on the first call, when the model (about 480 MB) downloads.
            let percent = Int((progress.fractionCompleted * 100).rounded())
            if percent > 0 && percent < 100 {
                status("Downloading the speech model… \(percent)%")
            }
        })

        var neuralVoice: VoiceTextToSpeech?
        if ProcessInfo.processInfo.physicalMemory >= Self.neuralVoiceMinimumMemory {
            status("Preparing the voice…")
            do {
                neuralVoice = try await KokoroTextToSpeech()
            } catch {
                // Fail down to the system voice, never to a cloud voice.
                Self.logger.error("Kokoro load failed, using the system voice: \(error.localizedDescription, privacy: .public)")
            }
        }

        let set = LocalVoiceEngineSet(
            classifier: classifier,
            speechToText: speechToText,
            neuralVoice: neuralVoice,
            systemVoice: SystemTextToSpeech()
        )
        loaded = set
        let seconds = Date().timeIntervalSince(started)
        Self.logger.log(
            "engines ready in \(seconds, format: .fixed(precision: 1), privacy: .public)s neuralVoice=\(neuralVoice != nil, privacy: .public)"
        )
        return set
    }

    func unload() {
        loaded = nil
    }
}
