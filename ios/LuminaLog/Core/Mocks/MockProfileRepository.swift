import Foundation

/// In-memory `ProfileRepository` for demo mode and tests.
/// Uses the same `DailyGoalStreak` as the Firestore implementation.
@MainActor
final class MockProfileRepository: ProfileRepository {

    private var storedProfile: UserProfile?
    private(set) var lastSaved: UserProfile?
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
        lastSaved = profile
        storedProfile = profile
        broadcast()
    }

    func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws {
        // No-op: the mock is seeded with `MockData.profile` at init.
    }

    func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws {
        guard var profile = storedProfile else { throw AuthServiceError.notSignedIn }
        let timezone = TimeZone(identifier: profile.timezone) ?? .current
        profile.stats = DailyGoalStreak.nextStats(
            current: profile.stats,
            wordCountDelta: wordCountDelta,
            entryDate: date,
            timezone: timezone
        )
        storedProfile = profile
        broadcast()
    }

    func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {
        guard var profile = storedProfile else { throw AuthServiceError.notSignedIn }
        switch kind {
        case .audio:
            profile.storageStats.audioCount += 1
            profile.storageStats.audioBytes += bytes
        case .image:
            profile.storageStats.imageCount += 1
            profile.storageStats.imageBytes += bytes
        case .video:
            profile.storageStats.videoCount += 1
            profile.storageStats.videoBytes += bytes
        }
        storedProfile = profile
        broadcast()
    }

    func recordTimeSpent(minutes: Int) async throws {
        guard var profile = storedProfile else { throw AuthServiceError.notSignedIn }
        profile.totalMinutesInApp += minutes
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
