import Foundation

/// Errors surfaced by `SpeechTranscriber` implementations.
enum SpeechTranscriberError: LocalizedError {
    /// The user denied speech-recognition or microphone permission.
    case notAuthorized
    /// No recognizer for the current locale, or the recognizer is offline.
    case unavailable
    /// The audio engine / session could not be started.
    case audioEngineFailed
    /// Recognition started but failed before producing a transcript.
    case recognitionFailed

    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Speech recognition permission was denied. You can enable it in Settings."
        case .unavailable:
            return "Speech recognition isn't available right now."
        case .audioEngineFailed:
            return "The microphone couldn't be started."
        case .recognitionFailed:
            return "We couldn't transcribe that audio."
        }
    }
}

/// On-device speech-to-text (architecture spec §2.3): live dictation into the
/// Create-entry editor, and file transcription for voice/video entries.
@MainActor
protocol SpeechTranscriber: AnyObject {

    /// Whether a recognizer exists for the current locale and is ready.
    var isAvailable: Bool { get }

    /// Request speech-recognition + microphone permission. Returns true when
    /// both are granted. Safe to call repeatedly (no-ops once determined).
    func requestAuthorization() async -> Bool

    /// Start live microphone dictation. Yields *cumulative* partial
    /// transcripts (each element replaces the previous one). The stream stays
    /// alive for the entire user-initiated session — recognition-request
    /// restarts after `isFinal` are transparent to the caller. The stream
    /// finishes only when `stopLiveTranscription()` is called or a fatal error
    /// occurs; it throws on authorization/engine/recognition failure.
    func startLiveTranscription() -> AsyncThrowingStream<String, Error>

    /// Stop the current live dictation session (finishes the stream).
    func stopLiveTranscription()

    /// Transcribe a recorded audio file (m4a etc.) and return the full text.
    func transcribeFile(url: URL) async throws -> String
}
