import XCTest
@testable import LuminaLog

/// The app-level `DailyGoalReconciler` watches today's entries and reconciles the
/// persisted daily-goal total + streak from the recomputed sum — the single
/// trigger that keeps today's count correct across transcript retries.
@MainActor
final class DailyGoalReconcilerTests: XCTestCase {

    private func entry(_ id: String, words: Int, createdAt: Date = Date()) -> JournalEntry {
        JournalEntry(
            id: id, userId: "u", type: .text, title: "t", createdAt: createdAt,
            content: Array(repeating: "word", count: words).joined(separator: " "),
            media: [], transcriptStatus: nil, processingStatus: nil, wordCount: words)
    }

    /// Polls `condition` on the main actor until it holds or the deadline passes,
    /// letting the reconciler's task make progress between checks.
    private func waitUntil(_ condition: () -> Bool, timeout: TimeInterval = 2) async {
        let start = Date()
        while !condition() {
            if Date().timeIntervalSince(start) > timeout { return }
            try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
        }
    }

    func testReconcilesTodayTotalFromEntriesOnStart() async throws {
        var profile = MockData.profile
        profile.timezone = "America/Los_Angeles"
        profile.stats = UserProfile.Stats()
        let profiles = MockProfileRepository(profile: profile)
        let journals = MockJournalRepository(entries: [entry("a", words: 3)])
        let reconciler = DailyGoalReconciler(journals: journals, profiles: profiles)

        let task = Task { await reconciler.run() }
        defer { task.cancel() }

        await waitUntil { !profiles.reconciledGoals.isEmpty }
        XCTAssertEqual(profiles.reconciledGoals.last?.todayTotal, 3)
    }

    func testReRecomputesWhenAnEntryChanges() async throws {
        var profile = MockData.profile
        profile.timezone = "America/Los_Angeles"
        profile.stats = UserProfile.Stats()
        let profiles = MockProfileRepository(profile: profile)
        let journals = MockJournalRepository(entries: [entry("a", words: 3)])
        let reconciler = DailyGoalReconciler(journals: journals, profiles: profiles)

        let task = Task { await reconciler.run() }
        defer { task.cancel() }
        await waitUntil { profiles.reconciledGoals.last?.todayTotal == 3 }

        // Simulate a transcript retry raising the entry's word count.
        try await journals.save(entry("a", words: 300))
        await waitUntil { profiles.reconciledGoals.last?.todayTotal == 300 }
        XCTAssertEqual(profiles.reconciledGoals.last?.todayTotal, 300)
    }
}
