import Foundation

/// `MediaUploader` for demo mode: "uploads" by copying the file into the
/// app's Documents directory and uses the local path as the s3Key.
final class MockMediaUploader: MediaUploader {

    private let directory: URL

    init() {
        let documents = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
        directory = documents.appendingPathComponent("DemoMedia", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
        let ext = fileURL.pathExtension.isEmpty ? "bin" : fileURL.pathExtension
        let fileName = "\(journalId)-\(UUID().uuidString).\(ext)"
        let destination = directory.appendingPathComponent(fileName)
        try FileManager.default.copyItem(at: fileURL, to: destination)
        // The s3Key is the path relative to Documents, so viewURL can resolve
        // it across launches (the Documents path changes between runs).
        return MediaItem(s3Key: "DemoMedia/\(fileName)", kind: kind)
    }

    func viewURL(for s3Key: String) async throws -> URL {
        let documents = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documents.appendingPathComponent(s3Key)
    }
}
