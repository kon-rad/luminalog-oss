import Foundation

/// Splits an audio timeline into consecutive chunks so no single transcription
/// upload exceeds the server's request-body limit (the `/transcribe-clip` route
/// caps the raw body at 25 MB). Pure and deterministic — the AVFoundation
/// down-sample + export lives in `AudioTranscriptionPreparer`; this only decides
/// the cut points, which keeps it unit-testable without real audio.
enum AudioChunkPlanner {

    /// One `[start, start + duration)` window in seconds.
    struct ChunkRange: Equatable {
        let start: Double
        let duration: Double
    }

    /// Consecutive ranges covering `[0, totalSeconds)`, each at most
    /// `maxChunkSeconds` long, with the final chunk carrying the remainder.
    /// Returns a single full-length range when the clip already fits, and an
    /// empty array for a non-positive `totalSeconds`/`maxChunkSeconds`.
    static func ranges(totalSeconds: Double, maxChunkSeconds: Double) -> [ChunkRange] {
        guard totalSeconds > 0, maxChunkSeconds > 0 else { return [] }
        var out: [ChunkRange] = []
        var start = 0.0
        // Epsilon guards against a spurious sliver chunk from floating-point drift
        // when `totalSeconds` is an exact multiple of `maxChunkSeconds`.
        while start < totalSeconds - 1e-6 {
            let duration = min(maxChunkSeconds, totalSeconds - start)
            out.append(ChunkRange(start: start, duration: duration))
            start += duration
        }
        return out
    }
}
