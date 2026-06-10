import Foundation

/// Scripted `SpeechTranscriber` for unit tests.
///
/// NOTE: unlike most mocks, this one is NOT used by `AppServices.mocks()` —
/// demo mode runs the real `AppleSpeechTranscriber` because it is purely
/// on-device and needs no backend. This mock exists for deterministic tests.
@MainActor
final class MockSpeechTranscriber: SpeechTranscriber {

    struct MockError: Error {}

    var isAvailable = true
    /// What `requestAuthorization()` returns.
    var authorizationGranted = true
    /// Cumulative partials yielded by `startLiveTranscription()`, in order.
    var scriptedPartials: [String] = ["Hello", "Hello world"]
    /// When set, the live stream throws after yielding all partials.
    var liveError: Error?
    /// When true, the live stream stays open after the scripted partials
    /// until `stopLiveTranscription()` is called (mimics the real session).
    var holdLiveStreamOpen = false
    /// Instant transcript returned by `transcribeFile(url:)`.
    var fileTranscript = "Mock file transcript."
    /// When set, `transcribeFile(url:)` throws instead.
    var fileError: Error?

    private(set) var requestAuthorizationCalls = 0
    private(set) var startLiveCalls = 0
    private(set) var stopLiveCalls = 0
    private(set) var transcribedFileURLs: [URL] = []

    private var liveContinuation: AsyncThrowingStream<String, Error>.Continuation?

    func requestAuthorization() async -> Bool {
        requestAuthorizationCalls += 1
        return authorizationGranted
    }

    func startLiveTranscription() -> AsyncThrowingStream<String, Error> {
        startLiveCalls += 1
        let partials = scriptedPartials
        let error = liveError
        let holdOpen = holdLiveStreamOpen
        return AsyncThrowingStream { continuation in
            for partial in partials {
                continuation.yield(partial)
            }
            if holdOpen {
                liveContinuation = continuation
            } else {
                continuation.finish(throwing: error)
            }
        }
    }

    func stopLiveTranscription() {
        stopLiveCalls += 1
        liveContinuation?.finish()
        liveContinuation = nil
    }

    func transcribeFile(url: URL) async throws -> String {
        transcribedFileURLs.append(url)
        if let fileError { throw fileError }
        return fileTranscript
    }
}
