import Foundation

/// A single AI-generated text artifact (summary or insights).
struct AIGeneration: Codable, Equatable, Sendable {
    var text: String
    var generatedAt: Date
    var model: String

    init(text: String, generatedAt: Date = Date(), model: String = "") {
        self.text = text
        self.generatedAt = generatedAt
        self.model = model
    }
}
