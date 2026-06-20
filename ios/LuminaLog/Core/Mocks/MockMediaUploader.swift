import Foundation

/// `MediaUploader` for demo mode: "uploads" by copying the file into the
/// app's Documents directory and uses the local path as the s3Key.
@MainActor
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

    func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload {
        // Stage a ciphertext-like temp file with some bytes so the upload path
        // (and any size probe) has a real file to work with.
        let encryptedURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        try Data([0x00, 0x01, 0x02]).write(to: encryptedURL)
        let s3Key = "mock/\(kind.rawValue)/\(UUID().uuidString)"
        let item = MediaItem(s3Key: s3Key, kind: kind)
        return PreparedUpload(encryptedFileURL: encryptedURL, s3Key: s3Key, mediaItem: item)
    }

    func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int,
                       journalId: String) async throws -> (s3Key: String, url: URL) {
        let key = s3Key ?? "mock/\(kind.rawValue)/\(UUID().uuidString)"
        return (key, URL(fileURLWithPath: "/dev/null"))
    }

    func viewURL(for s3Key: String) async throws -> URL {
        let documents = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documents.appendingPathComponent(s3Key)
    }

    func localFileURL(for s3Key: String) async throws -> URL {
        // Demo media is stored as plaintext local files; no decryption needed.
        try await viewURL(for: s3Key)
    }
}
