import Foundation

/// Turns a stream of per-frame speech probabilities (one per 256 ms Silero VAD
/// frame) into turn-taking events. Pure and model-free so the timing rules are
/// unit-testable; `VoiceCapturePipeline` feeds it and owns the audio.
struct VoiceTurnDetector {

    struct Config: Equatable {
        /// A frame at or above this probability opens a speech segment.
        var startThreshold: Float = 0.6
        /// Once speaking, a frame at or above this keeps the segment open
        /// (hysteresis, so a soft syllable does not count as silence).
        var endThreshold: Float = 0.35
        /// Consecutive silent frames that end the user's turn. 3 frames is about
        /// 770 ms: reflective journaling speech has long mid-thought pauses, and a
        /// premature end costs a wasted reply.
        var endSilenceFrames = 3
        /// Voiced frames that count as deliberate speech (about 510 ms). Used to
        /// interrupt the assistant: shorter sounds ("mm-hm", a cough, echo residue)
        /// must not cut the reply off.
        var sustainedFrames = 2
        /// Hard cap on one utterance (about 60 s) so a noisy room cannot hold the
        /// turn open forever.
        var maxUtteranceFrames = 234

        static let `default` = Config()
    }

    enum Event: Equatable {
        /// Speech began on this frame.
        case started
        /// The segment reached `sustainedFrames` voiced frames.
        case sustained
        /// The turn ended. `voicedFrames` lets the caller drop blips;
        /// `trailingSilenceFrames` is how much of the tail is silence (0 when the
        /// length cap forced the end mid-speech).
        case ended(voicedFrames: Int, trailingSilenceFrames: Int)
    }

    private(set) var isInSpeech = false
    private var voicedFrames = 0
    private var silenceRun = 0
    private var totalFrames = 0
    let config: Config

    init(config: Config = .default) {
        self.config = config
    }

    mutating func reset() {
        isInSpeech = false
        voicedFrames = 0
        silenceRun = 0
        totalFrames = 0
    }

    mutating func ingest(probability: Float) -> [Event] {
        var events: [Event] = []

        guard isInSpeech else {
            guard probability >= config.startThreshold else { return events }
            isInSpeech = true
            voicedFrames = 1
            silenceRun = 0
            totalFrames = 1
            events.append(.started)
            if config.sustainedFrames <= 1 { events.append(.sustained) }
            return events
        }

        totalFrames += 1
        if probability >= config.endThreshold {
            silenceRun = 0
            if probability >= config.startThreshold {
                voicedFrames += 1
                if voicedFrames == config.sustainedFrames { events.append(.sustained) }
            }
        } else {
            silenceRun += 1
        }

        if silenceRun >= config.endSilenceFrames || totalFrames >= config.maxUtteranceFrames {
            events.append(.ended(voicedFrames: voicedFrames, trailingSilenceFrames: silenceRun))
            reset()
        }
        return events
    }
}
