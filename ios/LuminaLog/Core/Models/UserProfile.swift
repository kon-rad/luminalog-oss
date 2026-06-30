import Foundation

/// The user document — `users/{uid}` in Firestore.
struct UserProfile: Codable, Equatable, Identifiable, Sendable {

    /// Journaling stats maintained transactionally on every save (spec §3).
    struct Stats: Codable, Equatable, Sendable {
        var streakCount: Int
        /// Best-ever value of `streakCount` (drives the leaderboard ranking).
        var maxStreakCount: Int
        /// The last *qualifying* day (its entries reached `DailyGoal.wordTarget`).
        var lastEntryDate: Date?
        var totalWords: Int
        /// Calendar day (user timezone) that `goalDayWords` accumulates for.
        var goalDayDate: Date?
        /// Words journaled so far on `goalDayDate`.
        var goalDayWords: Int
        /// Total number of prompt-answered journal entries saved by this user.
        var promptsAnswered: Int

        init(
            streakCount: Int = 0,
            maxStreakCount: Int = 0,
            lastEntryDate: Date? = nil,
            totalWords: Int = 0,
            goalDayDate: Date? = nil,
            goalDayWords: Int = 0,
            promptsAnswered: Int = 0
        ) {
            self.streakCount = streakCount
            self.maxStreakCount = maxStreakCount
            self.lastEntryDate = lastEntryDate
            self.totalWords = totalWords
            self.goalDayDate = goalDayDate
            self.goalDayWords = goalDayWords
            self.promptsAnswered = promptsAnswered
        }
    }

    /// Per-type media storage counters (plaintext — not sensitive).
    struct StorageStats: Codable, Equatable, Sendable {
        var audioBytes: Int
        var audioCount: Int
        var imageBytes: Int
        var imageCount: Int
        var videoBytes: Int
        var videoCount: Int

        var totalBytes: Int { audioBytes + imageBytes + videoBytes }
        var totalCount: Int { audioCount + imageCount + videoCount }

        init(
            audioBytes: Int = 0, audioCount: Int = 0,
            imageBytes: Int = 0, imageCount: Int = 0,
            videoBytes: Int = 0, videoCount: Int = 0
        ) {
            self.audioBytes = audioBytes
            self.audioCount = audioCount
            self.imageBytes = imageBytes
            self.imageCount = imageCount
            self.videoBytes = videoBytes
            self.videoCount = videoCount
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

    /// Extended onboarding profile fields (spec §5). All free-text, all
    /// field-encrypted at rest; injected into AI prompts alongside `biography`.
    struct ProfileDetails: Codable, Equatable, Sendable {
        var goals: String?
        var hobbies: String?
        var age: String?
        var gender: String?
        var challenges: String?
        var dailyHabits: String?
        var starSign: String?
        var maritalStatus: String?
        var location: String?
        var education: String?
        var work: String?
        var favoriteMovies: String?
        var favoriteArtists: String?
        var favoriteBooks: String?
        var languages: String?
        var friendsDescribe: String?

        init(
            goals: String? = nil, hobbies: String? = nil, age: String? = nil,
            gender: String? = nil, challenges: String? = nil, dailyHabits: String? = nil,
            starSign: String? = nil, maritalStatus: String? = nil, location: String? = nil,
            education: String? = nil, work: String? = nil, favoriteMovies: String? = nil,
            favoriteArtists: String? = nil, favoriteBooks: String? = nil,
            languages: String? = nil, friendsDescribe: String? = nil
        ) {
            self.goals = goals; self.hobbies = hobbies; self.age = age
            self.gender = gender; self.challenges = challenges; self.dailyHabits = dailyHabits
            self.starSign = starSign; self.maritalStatus = maritalStatus; self.location = location
            self.education = education; self.work = work; self.favoriteMovies = favoriteMovies
            self.favoriteArtists = favoriteArtists; self.favoriteBooks = favoriteBooks
            self.languages = languages; self.friendsDescribe = friendsDescribe
        }
    }

    /// Today's cached personalized prompts (five, one per life area).
    struct DailyPrompt: Codable, Equatable, Sendable {
        /// First prompt's text — kept for backward-compat with older docs that
        /// stored a single prompt and only have this field.
        var text: String
        var date: Date
        /// Journal entry ids the prompts were personalized from (proxy-written).
        var sourceEntryIds: [String]?
        /// The five area-anchored prompts. Absent on legacy single-prompt docs.
        var prompts: [DailyPromptItem]?

        /// The prompts to show — the stored five, or a single-item fallback
        /// synthesized from `text` for legacy docs.
        var items: [DailyPromptItem] {
            if let prompts, !prompts.isEmpty { return prompts }
            return [DailyPromptItem(area: "Reflection", text: text)]
        }

        init(
            text: String,
            date: Date = Date(),
            sourceEntryIds: [String]? = nil,
            prompts: [DailyPromptItem]? = nil
        ) {
            self.text = text
            self.date = date
            self.sourceEntryIds = sourceEntryIds
            self.prompts = prompts
        }

        /// Builds from a non-empty prompt set (first item populates `text`).
        init(items: [DailyPromptItem], date: Date = Date(), sourceEntryIds: [String]? = nil) {
            self.text = items.first?.text ?? ""
            self.date = date
            self.sourceEntryIds = sourceEntryIds
            self.prompts = items
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
    var storageStats: StorageStats
    var totalMinutesInApp: Int
    var dailyPrompt: DailyPrompt?
    var summaryConfig: SummaryConfig?
    /// Extended onboarding profile fields (free-text, field-encrypted).
    var details: ProfileDetails

    init(
        id: String,
        displayName: String = "",
        email: String = "",
        photoURL: URL? = nil,
        biography: String = "",
        createdAt: Date = Date(),
        timezone: String = TimeZone.current.identifier,
        stats: Stats = Stats(),
        storageStats: StorageStats = StorageStats(),
        totalMinutesInApp: Int = 0,
        dailyPrompt: DailyPrompt? = nil,
        summaryConfig: SummaryConfig? = nil,
        details: ProfileDetails = ProfileDetails()
    ) {
        self.id = id
        self.displayName = displayName
        self.email = email
        self.photoURL = photoURL
        self.biography = biography
        self.createdAt = createdAt
        self.timezone = timezone
        self.stats = stats
        self.storageStats = storageStats
        self.totalMinutesInApp = totalMinutesInApp
        self.dailyPrompt = dailyPrompt
        self.summaryConfig = summaryConfig
        self.details = details
    }
}
