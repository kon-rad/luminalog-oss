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

/// The full payload: both boards in one response.
struct Leaderboards: Decodable, Equatable {
    let streak: [LeaderboardEntry]
    let words: [LeaderboardEntry]
}
