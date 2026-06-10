import Foundation

/// Read/write access to the signed-in user's profile (`users/{uid}`).
protocol ProfileRepository: AnyObject {

    /// Live-updating stream of the user profile; nil while it does not exist.
    func profile() -> AsyncStream<UserProfile?>

    /// Persist profile edits (displayName, biography, photo, dailyPrompt, ...).
    func update(_ profile: UserProfile) async throws

    /// Transactionally update `stats` after a journal save: bump the streak
    /// per `StreakCalculator` and add the word-count delta (spec §3).
    func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws
}
