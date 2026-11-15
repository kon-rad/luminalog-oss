import Foundation

/// Scores one 256 ms frame of 16 kHz mono audio for speech. `SileroFrameClassifier`
/// is the real one; tests script probabilities.
protocol VoiceFrameClassifying: Sendable {
    /// Speech probability in 0...1 for `frame` (exactly `VoiceCapturePipeline.frameSize` samples).
    func probability(for frame: [Float]) async throws -> Float
    /// Drop recurrent state (new call, unmute).
    func reset() async
}

enum VoiceCaptureEvent: Equatable {
    case speechStarted
    /// The user has been talking long enough to count as deliberate speech.
    case sustainedSpeech
    /// A finished utterance, 16 kHz mono, with a short lead-in and little trailing silence.
    case utterance(samples: [Float], voicedFrames: Int)
}

/// Microphone samples in, turn-taking events out. Owns the audio buffers; the
/// timing rules live in `VoiceTurnDetector`.
actor VoiceCapturePipeline {

    /// Silero's unified model scores 4096-sample (256 ms) frames at 16 kHz.
    static let frameSize = 4096
    static let sampleRate = 16_000

    private let classifier: VoiceFrameClassifying
    private var detector: VoiceTurnDetector
    private var pending: [Float] = []
    /// The frame before speech began, so the first syllable is not clipped.
    private var preRoll: [Float] = []
    private var utterance: [Float] = []
    private var muted = false

    init(classifier: VoiceFrameClassifying, config: VoiceTurnDetector.Config = .default) {
        self.classifier = classifier
        self.detector = VoiceTurnDetector(config: config)
    }

    func setMuted(_ muted: Bool) async {
        self.muted = muted
        if muted { await reset() }
    }

    func reset() async {
        pending.removeAll(keepingCapacity: true)
        preRoll.removeAll(keepingCapacity: true)
        utterance.removeAll(keepingCapacity: true)
        detector.reset()
        await classifier.reset()
    }

    /// Feed any number of 16 kHz mono samples; returns the events they produced.
    func ingest(_ samples: [Float]) async -> [VoiceCaptureEvent] {
        guard !muted else { return [] }
        pending.append(contentsOf: samples)
        var events: [VoiceCaptureEvent] = []

        while pending.count >= Self.frameSize {
            let frame = Array(pending.prefix(Self.frameSize))
            pending.removeFirst(Self.frameSize)

            // A classifier error must not stall the call: treat the frame as silence.
            let probability = (try? await classifier.probability(for: frame)) ?? 0
            let wasInSpeech = detector.isInSpeech
            let detected = detector.ingest(probability: probability)

            if wasInSpeech || detected.contains(.started) {
                if !wasInSpeech { utterance = preRoll }
                utterance.append(contentsOf: frame)
            }
            preRoll = frame

            for event in detected {
                switch event {
                case .started:
                    events.append(.speechStarted)
                case .sustained:
                    events.append(.sustainedSpeech)
                case .ended(let voicedFrames, let trailingSilenceFrames):
                    // Keep one frame of trailing silence; the rest only slows STT down.
                    let trailing = max(0, trailingSilenceFrames - 1) * Self.frameSize
                    let kept = utterance.count > trailing ? Array(utterance.dropLast(trailing)) : utterance
                    events.append(.utterance(samples: kept, voicedFrames: voicedFrames))
                    utterance.removeAll(keepingCapacity: true)
                }
            }
        }
        return events
    }
}
