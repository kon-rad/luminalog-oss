import Foundation

/// Maps an audio file extension to the MIME content type sent to the
/// stateless `/transcribe-clip` endpoint. The recorder produces `.m4a`, but
/// uploaded files may be `.mp3` / `.wav`, so the type must reflect the real
/// format. Unknown extensions fall back to `audio/m4a` (the recorder default).
enum AudioContentType {
    static func mime(forPathExtension ext: String) -> String {
        switch ext.lowercased() {
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "m4a": return "audio/m4a"
        default: return "audio/m4a"
        }
    }

    /// Inverse of `mime(forPathExtension:)` — the file extension for a MIME type,
    /// used to name the temp file the transcription preparer reads with
    /// AVFoundation (which infers format from the container). Unknown types fall
    /// back to `m4a` (the recorder default).
    static func pathExtension(forMime mime: String) -> String {
        switch mime.lowercased() {
        case "audio/mpeg", "audio/mp3": return "mp3"
        case "audio/wav", "audio/x-wav", "audio/wave": return "wav"
        case "audio/m4a", "audio/mp4", "audio/x-m4a": return "m4a"
        default: return "m4a"
        }
    }
}
