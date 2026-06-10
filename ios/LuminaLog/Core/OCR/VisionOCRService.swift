import Foundation
import Vision

/// `OCRService` backed by Apple's Vision framework (spec §2.4):
/// `VNRecognizeTextRequest` at `.accurate` with language correction, which
/// handles handwriting reasonably well. Purely on-device.
@MainActor
final class VisionOCRService: OCRService {

    func recognizeText(in imageData: Data) async throws -> String {
        // Vision is CPU-heavy; run the request off the main actor.
        try await Task.detached(priority: .userInitiated) {
            let handler = VNImageRequestHandler(data: imageData)
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            do {
                try handler.perform([request])
            } catch {
                // Vision throws the same error type for unreadable data and
                // internal failures; map unreadable data distinctly.
                if (error as NSError).code == VNErrorCode.invalidImage.rawValue {
                    throw OCRServiceError.invalidImage
                }
                throw OCRServiceError.recognitionFailed
            }

            let lines = (request.results ?? [])
                .compactMap { $0.topCandidates(1).first?.string }
            return lines.joined(separator: "\n")
        }.value
    }
}
