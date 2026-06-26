import Foundation

/// A saved daily insights report — `dailyReports/{uid}/days/{yyyy-MM-dd}_{millis}`.
/// A day can hold several reports, so identity is the Firestore document id, not
/// the date. `id` is not part of the wire/Firestore body (it's the document id,
/// injected by the repository on read); it defaults to "" for transient values
/// decoded straight from the generate response.
struct DailyInsightsReport: Codable, Equatable, Sendable, Identifiable {
    var id: String = ""
    var date: String
    var insights: String
    var findings: String
    /// The day's "Gem" — a short, memorable line. Stored over the wire and in
    /// Firestore under the legacy key `question` (see CodingKeys / ADR-0038).
    var gem: String
    var emotionSummary: String
    var totalWords: Int
    /// Words the user entered today across all entry types (typed text plus
    /// transcribed voice/video). Shown on the card under "WORDS TODAY".
    var wordsToday: Int
    var streakCount: Int
    var emotions: [EmotionScore.Pick]
    var imageUrl: URL?
    var imageThumbUrl: URL?
    var imageQuery: String?
    var photographerName: String?
    var photographerUrl: URL?
    var sourceEntryIds: [String]
    var model: String
    var generatedAt: Date?

    /// Wire/Firestore keys. `gem` is persisted under the legacy `question` key so
    /// existing encrypted reports keep decrypting (AAD `dailyReports.question`).
    enum CodingKeys: String, CodingKey {
        case date, insights, findings
        case gem = "question"
        case emotionSummary, totalWords, wordsToday, streakCount, emotions
        case imageUrl, imageThumbUrl, imageQuery
        case photographerName, photographerUrl, sourceEntryIds, model, generatedAt
    }

    init(
        id: String = "",
        date: String, insights: String, findings: String, gem: String,
        emotionSummary: String, totalWords: Int, wordsToday: Int = 0, streakCount: Int,
        emotions: [EmotionScore.Pick], imageUrl: URL? = nil, imageThumbUrl: URL? = nil,
        imageQuery: String? = nil, photographerName: String? = nil, photographerUrl: URL? = nil,
        sourceEntryIds: [String] = [], model: String = "", generatedAt: Date? = nil
    ) {
        self.id = id
        self.date = date; self.insights = insights; self.findings = findings
        self.gem = gem; self.emotionSummary = emotionSummary
        self.totalWords = totalWords; self.wordsToday = wordsToday
        self.streakCount = streakCount; self.emotions = emotions
        self.imageUrl = imageUrl; self.imageThumbUrl = imageThumbUrl; self.imageQuery = imageQuery
        self.photographerName = photographerName; self.photographerUrl = photographerUrl
        self.sourceEntryIds = sourceEntryIds; self.model = model; self.generatedAt = generatedAt
    }
}
