import Foundation

/// A word and how many times it appears across the journal (word cloud).
/// Named `WordFrequency` to avoid colliding with the existing `WordCount`
/// word-counting utility enum in Core/Models.
struct WordFrequency: Equatable, Identifiable, Sendable {
    let word: String
    let count: Int
    var id: String { word }
}

/// Count of entries whose dominant emotion was `emotion` on a given day.
struct EmotionTrendPoint: Equatable, Identifiable, Sendable {
    let date: Date          // start of day
    let emotion: String
    let count: Int
    var id: String { "\(date.timeIntervalSince1970)-\(emotion)" }
}

/// One calendar day of journaling activity (heatmap cell).
struct ActivityDay: Equatable, Identifiable, Sendable {
    let date: Date          // start of day
    let entryCount: Int
    let wordCount: Int
    var id: Date { date }
}

/// Share of entries of one type (donut slice).
struct EntryTypeSlice: Equatable, Identifiable, Sendable {
    let type: JournalType
    let count: Int
    var id: String { type.rawValue }
}
