import Foundation

/// The user document — `users/{uid}` in Firestore.
struct UserProfile: Codable, Equatable, Identifiable, Sendable {

    /// Journaling stats maintained transactionally on every save (spec §3).
    struct Stats: Codable, Equatable, Sendable {
        var streakCount: Int
        /// The last *qualifying* day (its entries reached `DailyGoal.wordTarget`).
        var lastEntryDate: Date?
        var totalWords: Int
        /// Calendar day (user timezone) that `goalDayWords` accumulates for.
        var goalDayDate: Date?
        /// Words journaled so far on `goalDayDate`.
        var goalDayWords: Int

        init(
            streakCount: Int = 0,
            lastEntryDate: Date? = nil,
            totalWords: Int = 0,
            goalDayDate: Date? = nil,
            goalDayWords: Int = 0
        ) {
            self.streakCount = streakCount
            self.lastEntryDate = lastEntryDate
            self.totalWords = totalWords
            self.goalDayDate = goalDayDate
            self.goalDayWords = goalDayWords
        }
    }

    /// User-customizable summary generation settings (plaintext template).
    struct SummaryConfig: Codable, Equatable, Sendable {
        var wordLength: Int
        var systemPrompt: String

        init(wordLength: Int, systemPrompt: String) {
            self.wordLength = wordLength
            self.systemPrompt = systemPrompt
        }
    }

    /// Today's cached personalized prompt.
    struct DailyPrompt: Codable, Equatable, Sendable {
        var text: String
        var date: Date
        /// Journal entry ids the prompt was personalized from (proxy-written).
        var sourceEntryIds: [String]?

        init(text: String, date: Date = Date(), sourceEntryIds: [String]? = nil) {
            self.text = text
            self.date = date
            self.sourceEntryIds = sourceEntryIds
        }
    }

    var id: String
    var displayName: String
    var email: String
    var photoURL: URL?
    /// User-written bio; injected into all AI system prompts.
    var biography: String
    var createdAt: Date
    /// IANA timezone identifier (e.g. "America/Los_Angeles").
    var timezone: String
    var stats: Stats
    var dailyPrompt: DailyPrompt?
    var summaryConfig: SummaryConfig?

    init(
        id: String,
        displayName: String = "",
        email: String = "",
        photoURL: URL? = nil,
        biography: String = "",
        createdAt: Date = Date(),
        timezone: String = TimeZone.current.identifier,
        stats: Stats = Stats(),
        dailyPrompt: DailyPrompt? = nil,
        summaryConfig: SummaryConfig? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.email = email
        self.photoURL = photoURL
        self.biography = biography
        self.createdAt = createdAt
        self.timezone = timezone
        self.stats = stats
        self.dailyPrompt = dailyPrompt
        self.summaryConfig = summaryConfig
    }
}
