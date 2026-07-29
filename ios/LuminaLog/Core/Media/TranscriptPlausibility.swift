import Foundation

/// Decides whether a speech-to-text transcript is *plausibly complete* for the
/// length of audio it came from — the single gate against a provider returning
/// a word or two (or nothing) for a multi-minute recording, which otherwise got
/// saved as a successful `.ready` transcript and never re-transcribed.
///
/// Real speech runs ~2 words/second. The floor here is `0.05` words/second —
/// roughly 40× below that — so only *clearly* degenerate transcripts are
/// rejected: a 127 s clip that returns 1 word fails, while a genuinely terse
/// note ("Okay, tomorrow works" in 30 s) passes. When the audio duration is
/// unknown there is nothing to scale against, so it falls back to the old
/// non-empty rule.
enum TranscriptPlausibility {
    /// Expected words per second of audio, floored deliberately low so real
    /// (even sparse) speech always passes and only near-silent results fail.
    static let minWordsPerSecond = 0.05

    /// True when `transcript` is plausibly the complete transcript of
    /// `durationSec` seconds of audio.
    static func isPlausible(_ transcript: String, forDurationSec durationSec: Double?) -> Bool {
        let words = WordCount.of(transcript)
        guard let durationSec, durationSec > 0 else { return words > 0 }
        let expectedMin = max(1, Int((durationSec * minWordsPerSecond).rounded(.down)))
        return words >= expectedMin
    }
}
