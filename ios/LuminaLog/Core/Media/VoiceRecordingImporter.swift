import Foundation

/// Bridges a server-staged voice-call recording into zero-knowledge storage:
/// downloads the plaintext staging object, encrypts it on-device with the user
/// DEK, re-uploads the ciphertext under the user's own prefix, then asks the
/// server to finalize (set `recordingPath`, delete staging). Idempotent/retryable.
@MainActor
final class VoiceRecordingImporter {
    private let api: ProxyAPIClient
    private let media: MediaUploader
    private let keys: UserKeyStore
    private let repository: ChatRepository
    private let session: URLSession

    /// chatIds currently being processed — avoids concurrent duplicate work.
    private var inFlight: Set<String> = []

    init(api: ProxyAPIClient, media: MediaUploader, keys: UserKeyStore,
         repository: ChatRepository, session: URLSession = .shared) {
        self.api = api
        self.media = media
        self.keys = keys
        self.repository = repository
        self.session = session
    }

    private struct FinalizeBody: Encodable { let chatId: String; let recordingPath: String }

    /// Process every chat with a staged recording awaiting encryption. Consumes one
    /// snapshot of the chat stream (the launch/foreground trigger re-runs later).
    func sweep() async {
        for await chats in repository.chats() {
            for chat in chats where chat.pendingRecordingKey != nil && chat.recordingPath == nil {
                await process(chat: chat)
            }
            break
        }
    }

    /// Download → encrypt → upload → finalize for one chat. Safe to call twice.
    func process(chat: Chat) async {
        guard let stagingKey = chat.pendingRecordingKey,
              chat.recordingPath == nil,
              stagingKey.contains("/voice-staging/"),
              !inFlight.contains(chat.id),
              let dek = keys.currentDataKey else { return }
        inFlight.insert(chat.id)
        defer { inFlight.remove(chat.id) }

        // Final ciphertext key is derived from the staging key by segment swap
        // (both under users/<uid>/), so we never build a key from a raw uid.
        let finalKey = stagingKey.replacingOccurrences(of: "/voice-staging/", with: "/voice/")
        let tmp = FileManager.default.temporaryDirectory
        let plaintextURL = tmp.appendingPathComponent(UUID().uuidString + ".wav")
        let cipherURL = tmp.appendingPathComponent(UUID().uuidString)
        defer {
            try? FileManager.default.removeItem(at: plaintextURL)
            try? FileManager.default.removeItem(at: cipherURL)
        }

        do {
            // 1. Presigned GET → download the plaintext staging object.
            let getURL = try await media.viewURL(for: stagingKey)
            let (downloaded, getResp) = try await session.download(from: getURL)
            if let http = getResp as? HTTPURLResponse, !(200..<300).contains(http.statusCode) { return }
            try? FileManager.default.removeItem(at: plaintextURL)
            try FileManager.default.moveItem(at: downloaded, to: plaintextURL)

            // 2. Encrypt on-device (LLM1 chunked AES-256-GCM) with the DEK.
            try MediaCipher(key: dek).encryptFile(at: plaintextURL, to: cipherURL)

            // 3. Presigned PUT of the ciphertext to the stable final key.
            let bytes = ((try? FileManager.default.attributesOfItem(atPath: cipherURL.path))?[.size] as? NSNumber)?.intValue ?? 0
            let (_, putURL) = try await media.presignUpload(
                s3Key: finalKey, kind: .audio, ext: "wav", bytes: bytes, journalId: chat.id)
            var req = URLRequest(url: putURL)
            req.httpMethod = "PUT"
            req.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
            let (_, putResp) = try await session.upload(for: req, fromFile: cipherURL)
            guard let http = putResp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return }

            // 4. Server sets recordingPath, clears pendingRecordingKey, deletes staging.
            try await api.post(path: "/v1/vapi/recording-finalize",
                               body: FinalizeBody(chatId: chat.id, recordingPath: finalKey))
        } catch {
            // Leave pendingRecordingKey set; retried on next sweep. Idempotent.
        }
    }
}
