import Foundation

/// The user document — `users/{uid}` in Firestore.
struct UserProfile: Codable, Equatable, Identifiable, Sendable {

    /// Journaling stats maintained transactionally on every save (spec §3).
    struct Stats: Codable, Equatable, Sendable {
        var streakCount: Int
        var lastEntryDate: Date?
        var totalWords: Int

        init(streakCount: Int = 0, lastEntryDate: Date? = nil, totalWords: Int = 0) {
            self.streakCount = streakCount
            self.lastEntryDate = lastEntryDate
            self.totalWords = totalWords
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

    init(
        id: String,
        displayName: String = "",
        email: String = "",
        photoURL: URL? = nil,
        biography: String = "",
        createdAt: Date = Date(),
        timezone: String = TimeZone.current.identifier,
        stats: Stats = Stats(),
        dailyPrompt: DailyPrompt? = nil
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
    }
}
