import Foundation

/// Errors surfaced by `OCRService` implementations.
enum OCRServiceError: LocalizedError {
    /// The data could not be read as an image.
    case invalidImage
    /// Vision failed while running text recognition.
    case recognitionFailed

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "That image couldn't be read."
        case .recognitionFailed:
            return "Text couldn't be recognized in that image."
        }
    }
}

/// On-device OCR for image entries (architecture spec §2.4).
@MainActor
protocol OCRService: AnyObject {

    /// Recognize text in an image. Returns recognized lines joined with
    /// newlines (empty string when the image contains no readable text).
    func recognizeText(in imageData: Data) async throws -> String
}
