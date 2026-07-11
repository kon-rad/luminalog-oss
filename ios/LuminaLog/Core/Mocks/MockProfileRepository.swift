import Foundation

/// In-memory `ProfileRepository` for demo mode and tests.
/// Uses the same `DailyGoalStreak` as the Firestore implementation.
@MainActor
final class MockProfileRepository: ProfileRepository {

    private var storedProfile: UserProfile?
    private(set) var lastSaved: UserProfile?
    /// Records every `addTotalWords` delta, for tests asserting on the credited
    /// lifetime word delta.
    private(set) var recordedDeltas: [Int] = []
    /// Records every `reconcileDailyGoal(todayTotal:now:)` call.
    private(set) var reconciledGoals: [(todayTotal: Int, now: Date)] = []
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

    @discardableResult
    func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws -> Bool {
        // The mock is seeded at init; report "already existed" so a merge after
        // this uses fill-blanks-only (matching a returning user).
        return storedProfile == nil
    }

    func mergeOnboardingDraft(_ draft: [String: String], overwriteExisting: Bool) async throws {
        guard let current = storedProfile,
              let updated = applyingOnboardingDraft(draft, to: current, overwriteExisting: overwriteExisting) else { return }
        try await update(updated)
    }

    func addTotalWords(delta: Int) async throws {
        recordedDeltas.append(delta)
        guard delta != 0 else { return }
        guard var profile = storedProfile else { throw AuthServiceError.notSignedIn }
        profile.stats.totalWords += delta
        storedProfile = profile
        broadcast()
    }

    func reconcileDailyGoal(todayTotal: Int, now: Date) async throws {
        reconciledGoals.append((todayTotal, now))
        guard var profile = storedProfile else { throw AuthServiceError.notSignedIn }
        let timezone = TimeZone(identifier: profile.timezone) ?? .current
        profile.stats = DailyGoalStreak.reconciled(
            current: profile.stats,
            todayTotal: todayTotal,
            now: now,
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

    func recordPromptAnswered() async throws {
        guard var profile = storedProfile else { throw AuthServiceError.notSignedIn }
        profile.stats.promptsAnswered += 1
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
