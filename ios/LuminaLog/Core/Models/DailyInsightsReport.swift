import Foundation

/// A saved daily insights report — `dailyReports/{uid}/days/{yyyy-MM-dd}`.
struct DailyInsightsReport: Codable, Equatable, Sendable, Identifiable {
    var id: String { date }            // "yyyy-MM-dd"
    var date: String
    var insights: String
    var findings: String
    var question: String
    var emotionSummary: String
    var totalWords: Int
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

    init(
        date: String, insights: String, findings: String, question: String,
        emotionSummary: String, totalWords: Int, streakCount: Int,
        emotions: [EmotionScore.Pick], imageUrl: URL? = nil, imageThumbUrl: URL? = nil,
        imageQuery: String? = nil, photographerName: String? = nil, photographerUrl: URL? = nil,
        sourceEntryIds: [String] = [], model: String = "", generatedAt: Date? = nil
    ) {
        self.date = date; self.insights = insights; self.findings = findings
        self.question = question; self.emotionSummary = emotionSummary
        self.totalWords = totalWords; self.streakCount = streakCount; self.emotions = emotions
        self.imageUrl = imageUrl; self.imageThumbUrl = imageThumbUrl; self.imageQuery = imageQuery
        self.photographerName = photographerName; self.photographerUrl = photographerUrl
        self.sourceEntryIds = sourceEntryIds; self.model = model; self.generatedAt = generatedAt
    }
}
