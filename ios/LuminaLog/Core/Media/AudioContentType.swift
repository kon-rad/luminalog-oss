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
}
