import Foundation

/// One personalized daily journaling prompt, anchored to a life area
/// (`area` — e.g. "Relationships") with the personalized `text` question.
/// The server returns five of these per day, one per area, in carousel order.
struct DailyPromptItem: Codable, Equatable, Sendable, Identifiable {
    /// Fixed life-area label, shown as the card's chip. Stable across users.
    var area: String
    /// The personalized question (one sentence, ends with "?").
    var text: String

    /// Stable within a day's set — areas are unique, so the label identifies the card.
    var id: String { area }

    init(area: String, text: String) {
        self.area = area
        self.text = text
    }
}
