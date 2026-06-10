import Foundation

/// Scripted `OCRService` for unit tests.
///
/// NOTE: unlike most mocks, this one is NOT used by `AppServices.mocks()` —
/// demo mode runs the real `VisionOCRService` because it is purely on-device
/// and needs no backend. This mock exists for deterministic tests.
@MainActor
final class MockOCRService: OCRService {

    struct MockError: Error {}

    /// Per-call scripted results; calls beyond the script return
    /// "Recognized text N".
    var scriptedTexts: [String] = []
    /// When set, every call throws instead.
    var error: Error?

    private(set) var recognizeCalls = 0

    func recognizeText(in imageData: Data) async throws -> String {
        recognizeCalls += 1
        if let error { throw error }
        if recognizeCalls <= scriptedTexts.count {
            return scriptedTexts[recognizeCalls - 1]
        }
        return "Recognized text \(recognizeCalls)"
    }
}
