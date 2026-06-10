import Foundation

/// In-memory `ProfileRepository` for demo mode and tests.
/// Uses the same `StreakCalculator` as the Firestore implementation.
@MainActor
final class MockProfileRepository: ProfileRepository {

    private var storedProfile: UserProfile?
    private var continuations: [UUID: AsyncStream<UserProfile?>.Continuation] = [:]

    init(profile: UserProfile? = MockData.profile) {
        storedProfile = profile
    }

    // MARK: - ProfileRepository

    func profile() -> AsyncStream<UserProfile?> {
        AsyncStream { continuation in
            let key = UUID()
            continuations[key] = continuation
            continuation.onTermination = { [weak self] _ in
                // onTermination runs off the main actor; hop back before
                // touching main-actor state.
                Task { @MainActor in
                    self?.continuations[key] = nil
                }
            }
            continuation.yield(storedProfile)
        }
    }

    func update(_ profile: UserProfile) async throws {
        storedProfile = profile
        broadcast()
    }

    func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws {
        guard var profile = storedProfile else { throw AuthServiceError.notSignedIn }
        let timezone = TimeZone(identifier: profile.timezone) ?? .current
        let previousTotal = profile.stats.totalWords
        var next = StreakCalculator.nextStats(
            current: profile.stats,
            entryDate: date,
            timezone: timezone
        )
        next.totalWords = previousTotal + wordCountDelta
        profile.stats = next
        storedProfile = profile
        broadcast()
    }

    // MARK: - Broadcast

    private func broadcast() {
        for continuation in continuations.values {
            continuation.yield(storedProfile)
        }
    }
}
