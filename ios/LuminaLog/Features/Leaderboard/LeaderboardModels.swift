import Foundation

/// One ranked row in a leaderboard board, decoded from `/v1/leaderboards`.
struct LeaderboardEntry: Decodable, Equatable, Identifiable {
    let rank: Int
    let userId: String
    let displayName: String
    /// Public provider photo, or nil (the client shows an initials circle).
    let photoURL: URL?
    /// Streak count or word count, depending on the board.
    let value: Int

    var id: String { userId }
}

/// The full payload: streak, words, and prompts boards in one response.
struct Leaderboards: Decodable, Equatable {
    let streak: [LeaderboardEntry]
    let words: [LeaderboardEntry]
    let prompts: [LeaderboardEntry]

    init(streak: [LeaderboardEntry] = [], words: [LeaderboardEntry] = [], prompts: [LeaderboardEntry] = []) {
        self.streak = streak
        self.words = words
        self.prompts = prompts
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        streak = try c.decode([LeaderboardEntry].self, forKey: .streak)
        words = try c.decode([LeaderboardEntry].self, forKey: .words)
        prompts = (try? c.decode([LeaderboardEntry].self, forKey: .prompts)) ?? []
    }

    enum CodingKeys: String, CodingKey {
        case streak, words, prompts
    }
}
