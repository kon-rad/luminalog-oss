import Foundation
import OSLog

protocol UploadTransport {
    /// PUT `file` to `url`, returns the HTTP status code (or 0 for a transport error).
    func put(file: URL, to url: URL) async -> Int
}

/// Live transport over a background URLSession. Bridges each task to an async
/// result; the journal remains the durable source of truth so a relaunch can finalize.
final class BackgroundUploadTransport: NSObject, UploadTransport, URLSessionDataDelegate {
    static let identifier = "com.konradgnat.luminalog.uploads"
    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.background(withIdentifier: Self.identifier)
        cfg.isDiscretionary = false
        cfg.sessionSendsLaunchEvents = true
        return URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
    }()
    private var continuations: [Int: CheckedContinuation<Int, Never>] = [:]
    private let lock = NSLock()
    var backgroundCompletionHandler: (() -> Void)?
    func activate() { _ = session }

    func put(file: URL, to url: URL) async -> Int {
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        let task = session.uploadTask(with: req, fromFile: file)
        return await withCheckedContinuation { cont in
            lock.lock(); continuations[task.taskIdentifier] = cont; lock.unlock()
            task.resume()
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let status = (task.response as? HTTPURLResponse)?.statusCode ?? (error == nil ? 200 : 0)
        lock.lock(); let cont = continuations.removeValue(forKey: task.taskIdentifier); lock.unlock()
        cont?.resume(returning: status)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async { self.backgroundCompletionHandler?(); self.backgroundCompletionHandler = nil }
    }
}

@MainActor
final class UploadManager {
    private let journal: UploadJournal
    private let transport: UploadTransport
    private let presign: (PendingUpload) async throws -> URL
    private let onFinalize: (PendingEntry) -> Void
    private let onPermanentFailure: (String) -> Void
    private let maxAttempts: Int
    private let backoff: (Int) -> Double
    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "upload")

    init(journal: UploadJournal,
         transport: UploadTransport,
         presign: @escaping (PendingUpload) async throws -> URL,
         onFinalize: @escaping (PendingEntry) -> Void,
         onPermanentFailure: @escaping (String) -> Void = { _ in },
         maxAttempts: Int = 5,
         backoff: @escaping (Int) -> Double = { attempt in min(60, pow(2.0, Double(attempt))) }) {
        self.journal = journal; self.transport = transport; self.presign = presign
        self.onFinalize = onFinalize; self.onPermanentFailure = onPermanentFailure
        self.maxAttempts = maxAttempts; self.backoff = backoff
    }

    func startAll(for entry: PendingEntry) async {
        for upload in entry.uploads where upload.state != .uploaded {
            await uploadOne(draftId: entry.draftId, attachmentId: upload.attachmentId)
        }
        if let refreshed = journal.entry(draftId: entry.draftId), refreshed.allUploaded {
            onFinalize(refreshed)
            cleanup(refreshed)
            journal.remove(draftId: refreshed.draftId)
        }
    }

    private func uploadOne(draftId: String, attachmentId: UUID) async {
        while true {
            guard let entry = journal.entry(draftId: draftId),
                  let upload = entry.uploads.first(where: { $0.attachmentId == attachmentId }) else { return }
            if upload.state == .uploaded { return }
            do {
                let url = try await presign(upload)
                let status = await transport.put(file: upload.encryptedURL, to: url)
                if (200..<300).contains(status) {
                    try journal.markUploaded(draftId: draftId, attachmentId: attachmentId, s3Key: upload.s3Key)
                    return
                }
                if status == 403 { continue }    // expired presign → re-presign SAME key (no attempt bump)
                if await bumpOrFail(draftId: draftId, attachmentId: attachmentId) { return }
            } catch {
                Self.logger.error("upload error \(draftId): \(error.localizedDescription)")
                if await bumpOrFail(draftId: draftId, attachmentId: attachmentId) { return }
            }
        }
    }

    /// Increment attempt count; sleep for backoff; return true if the cap was hit
    /// (record marked .failed, permanent failure surfaced) — caller should stop.
    private func bumpOrFail(draftId: String, attachmentId: UUID) async -> Bool {
        var hitCap = false
        try? journal.mutate(draftId: draftId) { e in
            guard let i = e.uploads.firstIndex(where: { $0.attachmentId == attachmentId }) else { return }
            e.uploads[i].attemptCount += 1
            if e.uploads[i].attemptCount >= maxAttempts { e.uploads[i].state = .failed; hitCap = true }
        }
        if hitCap { onPermanentFailure(draftId); return true }
        let attempt = journal.entry(draftId: draftId)?.uploads.first(where: { $0.attachmentId == attachmentId })?.attemptCount ?? 1
        let delay = backoff(attempt)
        if delay > 0 { try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000)) }
        return false
    }

    private func cleanup(_ entry: PendingEntry) {
        for u in entry.uploads { try? FileManager.default.removeItem(at: u.encryptedURL) }
    }
}
