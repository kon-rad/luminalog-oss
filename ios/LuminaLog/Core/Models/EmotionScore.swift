import Foundation

/// Hume Expression Measurement result stored on a journal entry (`emotion` field).
struct EmotionScore: Codable, Equatable, Sendable {
    struct Pick: Codable, Equatable, Sendable {
        var name: String
        var score: Double
    }
    /// "text" | "audio" | "text+audio".
    var source: String
    var scores: [String: Double]
    var top: [Pick]
    var model: String
    var scoredAt: Date?

    init(source: String, scores: [String: Double], top: [Pick], model: String = "", scoredAt: Date? = nil) {
        self.source = source; self.scores = scores; self.top = top
        self.model = model; self.scoredAt = scoredAt
    }
}
