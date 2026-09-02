import XCTest
import UserNotifications
@testable import LuminaLog

@MainActor
final class EncouragementCoordinatorTests: XCTestCase {

    // MARK: - Doubles

    /// Mirrors the AIService stub shape used by HomeViewModelTests: only the
    /// method under test carries behavior, everything else is inert.
    private final class StubAI: AIService {
        var callCount = 0
        var result: [GeneratedEncouragement] = (0..<5).map {
            GeneratedEncouragement(title: "T\($0)", body: "B\($0)")
        }
        var error: Error?

        func generateEncouragements() async throws -> [GeneratedEncouragement] {
            callCount += 1
            if let error { throw error }
            return result
        }

        func dailyPrompt() async throws -> [DailyPromptItem] { [] }
        func generateSummary(journalId: String) async throws -> AIGeneration {
            AIGeneration(text: "", model: "stub")
        }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async {}
        func deleteEntry(journalId: String) async throws {}
        func transcribeJournal(journalId: String) async throws {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
        func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
            throw URLError(.cancelled)
        }
    }

    private final class InMemoryRepo: EncouragementRepository {
        var stored: [EncouragementMessage] = []
        var batchDateKeys: Set<String> = []
        var deletedIds: [String] = []

        func undelivered() async throws -> [EncouragementMessage] {
            stored.filter { !$0.isDelivered }.sorted { $0.id < $1.id }
        }
        func hasBatch(forDateKey dateKey: String) async throws -> Bool {
            batchDateKeys.contains(dateKey)
        }
        func save(_ messages: [EncouragementMessage]) async throws {
            stored.append(contentsOf: messages)
            for m in messages { batchDateKeys.insert(EncouragementIds.dateKeyPrefix(m.id)) }
        }
        func markDelivered(id: String, at date: Date) async throws {
            guard let i = stored.firstIndex(where: { $0.id == id }) else { return }
            stored[i].deliveredAt = date
        }
        func deleteExpired(createdBefore date: Date) async throws {
            let doomed = stored.filter { !$0.isDelivered && $0.createdAt < date }
            deletedIds.append(contentsOf: doomed.map(\.id))
            stored.removeAll { doomed.contains($0) }
        }
    }

    private final class SpyScheduler: ReminderScheduling {
        var authorized = true
        var scheduled: [(id: String, title: String, body: String, date: Date?)] = []
        func requestAuthorization() async -> Bool { authorized }
        func authorizationStatus() async -> UNAuthorizationStatus { authorized ? .authorized : .denied }
        func reschedule(identifier: String, title: String, body: String, to fireDate: Date?) async {
            scheduled.append((identifier, title, body, fireDate))
        }
    }

    // MARK: - Fixtures

    private func date(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.timeZone = TimeZone(identifier: "UTC")
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)!
    }

    private var defaults: UserDefaults!
    private let suiteName = "EncouragementCoordinatorTests"

    override func setUp() {
        super.setUp()
        UserDefaults().removePersistentDomain(forName: suiteName)
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        UserDefaults().removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    private func makeCoordinator(
        ai: StubAI,
        repo: InMemoryRepo,
        scheduler: SpyScheduler,
        now: String = "2026-08-24T05:00:00Z"
    ) -> EncouragementCoordinator {
        EncouragementCoordinator(
            ai: ai, repository: repo, scheduler: scheduler,
            defaults: defaults, now: { self.date(now) }
        )
    }

    /// Profile pinned to UTC so slot times are predictable regardless of the
    /// simulator's timezone.
    private func utcProfile() -> UserProfile {
        var profile = UserProfile(id: "u1", displayName: "Kon")
        profile.timezone = "UTC"
        return profile
    }

    // MARK: - Tests

    func testGeneratesSavesAndSchedulesThreeNotifications() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(ai.callCount, 1)
        XCTAssertEqual(repo.stored.count, 5)
        let armed = scheduler.scheduled.filter { $0.date != nil }
        XCTAssertEqual(armed.count, 3)
        XCTAssertEqual(armed.map(\.title), ["T0", "T1", "T2"])
        XCTAssertEqual(repo.stored.filter(\.isDelivered).count, 3)
    }

    func testDoesNothingWhenTheFeatureIsDisabled() async {
        defaults.set(false, forKey: EncouragementPrefs.enabledKey)
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(ai.callCount, 0)
        XCTAssertTrue(repo.stored.isEmpty)
        // Every slot is explicitly cancelled (scheduled with a nil date).
        XCTAssertEqual(scheduler.scheduled.filter { $0.date == nil }.count, EncouragementSlot.all.count)
    }

    func testSkipsTheAICallWhenTodaysBatchAlreadyExists() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        repo.batchDateKeys.insert("2026-08-24")
        repo.stored = [
            EncouragementMessage(id: "2026-08-24_0000000000000_0", title: "Old", body: "Body",
                                 createdAt: date("2026-08-24T05:00:00Z"), deliveredAt: nil),
        ]
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(ai.callCount, 0)
        XCTAssertEqual(scheduler.scheduled.filter { $0.date != nil }.map(\.title), ["Old"])
    }

    func testDeliversOldestFirstSoLeftoversRotateIn() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        repo.stored = [
            EncouragementMessage(id: "2026-08-23_0000000000000_0", title: "Yesterday", body: "Left over",
                                 createdAt: date("2026-08-23T05:00:00Z"), deliveredAt: nil),
        ]
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        let armed = scheduler.scheduled.filter { $0.date != nil }
        XCTAssertEqual(armed.map(\.title), ["Yesterday", "T0", "T1"])
    }

    func testPrunesMessagesOlderThanThreeDays() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        repo.stored = [
            EncouragementMessage(id: "2026-08-19_0000000000000_0", title: "Stale", body: "Old",
                                 createdAt: date("2026-08-19T05:00:00Z"), deliveredAt: nil),
        ]
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertTrue(repo.deletedIds.contains("2026-08-19_0000000000000_0"))
        XCTAssertFalse(scheduler.scheduled.contains { $0.title == "Stale" })
    }

    func testSchedulesOnlyRemainingSlotsOnAMidDayCatchUp() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler, now: "2026-08-24T14:00:00Z")

        await coordinator.runCycle(profile: utcProfile())

        let armed = scheduler.scheduled.filter { $0.date != nil }
        XCTAssertEqual(armed.count, 1)
        XCTAssertEqual(armed[0].id, EncouragementSlot.all[2].id)
    }

    func testCancelsUnfilledSlotsSoNoStaleNotificationSurvives() async {
        let ai = StubAI(); ai.result = [GeneratedEncouragement(title: "Only", body: "One")]
        let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(scheduler.scheduled.filter { $0.date != nil }.count, 1)
        XCTAssertEqual(scheduler.scheduled.filter { $0.date == nil }.count, 2)
    }

    func testDoesNotCallTheAIWhenNotificationPermissionIsDenied() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        scheduler.authorized = false
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(ai.callCount, 0)
        XCTAssertTrue(repo.stored.isEmpty)
    }

    func testStoresNothingWhenTheAIReturnsNoMessages() async {
        let ai = StubAI(); ai.result = []
        let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertTrue(repo.stored.isEmpty)
        XCTAssertTrue(scheduler.scheduled.filter { $0.date != nil }.isEmpty)
    }

    func testStoresNothingWhenTheAICallFails() async {
        let ai = StubAI(); ai.error = URLError(.notConnectedToInternet)
        let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertTrue(repo.stored.isEmpty)
        XCTAssertTrue(scheduler.scheduled.filter { $0.date != nil }.isEmpty)
    }

    func testDisablingCancelsEveryPendingSlot() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())
        scheduler.scheduled.removeAll()

        let enabled = await coordinator.setEnabled(false, profile: utcProfile())

        XCTAssertFalse(enabled)
        XCTAssertFalse(coordinator.isEnabled)
        XCTAssertEqual(scheduler.scheduled.filter { $0.date == nil }.count, EncouragementSlot.all.count)
    }

    func testIsEnabledDefaultsToOn() {
        let coordinator = makeCoordinator(ai: StubAI(), repo: InMemoryRepo(), scheduler: SpyScheduler())
        XCTAssertTrue(coordinator.isEnabled)
    }
}
