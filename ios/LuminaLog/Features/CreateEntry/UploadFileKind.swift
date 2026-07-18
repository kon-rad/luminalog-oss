import UniformTypeIdentifiers

/// Classifies a file chosen via the "Upload" file importer into the entry kind
/// it should become. Order matters: audio is checked before movie because some
/// audio types also conform to audiovisual content.
enum UploadFileKind {
    case audio
    case video
    case image
    case unsupported

    /// The conservative, native format set the importer accepts.
    static let allowedContentTypes: [UTType] = [
        .mpeg4Audio, .mp3, .wav,      // audio: m4a, mp3, wav
        .mpeg4Movie, .quickTimeMovie, // video: mp4, mov
        .jpeg, .png, .heic,           // image: jpg, png, heic
    ]

    static func classify(_ type: UTType?) -> UploadFileKind {
        guard let type else { return .unsupported }
        if type.conforms(to: .audio) { return .audio }
        if type.conforms(to: .movie) || type.conforms(to: .audiovisualContent) { return .video }
        if type.conforms(to: .image) { return .image }
        return .unsupported
    }
}
