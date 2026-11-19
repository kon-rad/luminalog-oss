import Foundation

/// A life-area prompt or the optional daily narrative identity Story question.
struct DailyPromptItem: Codable, Equatable, Sendable, Identifiable {
    /// Life-area or Story type label, shown as the card chip.
    var area: String
    /// The personalized question (one sentence, ends with "?").
    var text: String
    var storyType: String? = nil

    /// Stable within a day's set — areas are unique, so the label identifies the card.
    var id: String { storyType.map { "story:\($0)" } ?? area }

    var entryPrompt: String { storyType == nil ? text : "Story: \(area)\n\(text)" }

    init(area: String, text: String, storyType: String? = nil) {
        self.storyType = storyType
        self.area = area
        self.text = text
    }
}
