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
        var result = GeneratedMirrorEchoes(morning: "T-morning", afternoon: "T-afternoon", evening: "T-evening")
        var error: Error?

        func generateMirrorEchoes() async throws -> GeneratedMirrorEchoes {
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

        func hasBatch(forDateKey dateKey: String) async throws -> Bool {
            batchDateKeys.contains(dateKey)
        }
        func save(_ messages: [EncouragementMessage]) async throws {
            stored.append(contentsOf: messages)
            for m in messages { batchDateKeys.insert(EncouragementIds.dateKeyPrefix(m.id)) }
        }
        func messages(forDateKey dateKey: String) async throws -> [EncouragementMessage] {
            stored.filter { EncouragementIds.dateKeyPrefix($0.id) == dateKey }
        }
        func markDelivered(id: String, at date: Date) async throws {
            guard let i = stored.firstIndex(where: { $0.id == id }) else { return }
            stored[i].deliveredAt = date
        }
        func recentDelivered(limit: Int, before now: Date, after lastDeliveredAt: Date?) async throws -> [EncouragementMessage] {
            let delivered = stored
                .filter { guard let at = $0.deliveredAt else { return false }; return at <= now }
                .sorted { $0.deliveredAt! > $1.deliveredAt! }
            let remaining = lastDeliveredAt.map { cursor in delivered.drop { $0.deliveredAt! >= cursor } } ?? ArraySlice(delivered)
            return Array(remaining.prefix(limit))
        }
    }

    private final class SpyScheduler: ReminderScheduling {
        /// What `requestAuthorization()` returns, i.e. what the user answers
        /// the system prompt with. Only consulted when `status` is
        /// `.notDetermined`, matching the real `UNUserNotificationCenter`.
        var authorized = true
        /// What `authorizationStatus()` reports before any request this test
        /// makes. Defaults to already-authorized so the existing scheduling
        /// tests don't need to know about the permission dance.
        var status: UNAuthorizationStatus = .authorized
        private(set) var requestAuthorizationCallCount = 0
        var scheduled: [(id: String, title: String, body: String, date: Date?)] = []
        func requestAuthorization() async -> Bool {
            requestAuthorizationCallCount += 1
            if authorized { status = .authorized }
            return authorized
        }
        func authorizationStatus() async -> UNAuthorizationStatus { status }
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

    func testGeneratesSavesAndSchedulesThreeEchoes() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(ai.callCount, 1)
        XCTAssertEqual(repo.stored.count, 3)
        let armed = scheduler.scheduled.filter { $0.date != nil }
        XCTAssertEqual(armed.count, 3)
        // The notification title is always the static feature name, never
        // model-generated copy; the echo sentence is the body.
        XCTAssertEqual(armed.map(\.title), [EncouragementPrefs.displayName, EncouragementPrefs.displayName, EncouragementPrefs.displayName])
        XCTAssertEqual(armed.map(\.body), ["T-morning", "T-afternoon", "T-evening"])
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
            EncouragementMessage(id: "2026-08-24_morning", timeOfDay: .morning, text: "Old",
                                 createdAt: date("2026-08-24T05:00:00Z"), deliveredAt: nil),
        ]
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(ai.callCount, 0)
        XCTAssertEqual(scheduler.scheduled.filter { $0.date != nil }.map(\.body), ["Old"])
    }

    func testSkipsASlotWhenTheModelHadNothingToGroundItIn() async {
        let ai = StubAI(); ai.result = GeneratedMirrorEchoes(morning: "T-morning", afternoon: nil, evening: "T-evening")
        let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(repo.stored.count, 2)
        let armed = scheduler.scheduled.filter { $0.date != nil }
        XCTAssertEqual(armed.map(\.body), ["T-morning", "T-evening"])
        // The un-grounded afternoon slot is explicitly cancelled, not left dangling.
        XCTAssertEqual(scheduler.scheduled.filter { $0.date == nil }.map(\.id), [EncouragementSlot.all[1].id])
    }

    func testSchedulesOnlyRemainingSlotsOnAMidDayCatchUp() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler, now: "2026-08-24T14:00:00Z")

        await coordinator.runCycle(profile: utcProfile())

        let armed = scheduler.scheduled.filter { $0.date != nil }
        XCTAssertEqual(armed.count, 1)
        XCTAssertEqual(armed[0].id, EncouragementSlot.all[2].id)
        XCTAssertEqual(armed[0].body, "T-evening")
        // The two already-past slots are cancelled, not silently left unarmed.
        XCTAssertEqual(scheduler.scheduled.filter { $0.date == nil }.count, 2)
    }

    func testDoesNotCallTheAIWhenNotificationPermissionIsDenied() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        scheduler.status = .denied
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(ai.callCount, 0)
        XCTAssertTrue(repo.stored.isEmpty)
        // Already-denied is a terminal OS state; re-asking would be pointless.
        XCTAssertEqual(scheduler.requestAuthorizationCallCount, 0)
    }

    /// The feature defaults to enabled and its Settings toggle is rarely
    /// touched, so the cycle itself must be the thing that requests OS
    /// permission the first time it runs on a device that has never been
    /// asked. Without this, the whole feature silently never activates.
    func testRequestsPermissionWhenNotYetDetermined() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        scheduler.status = .notDetermined
        scheduler.authorized = true
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(scheduler.requestAuthorizationCallCount, 1)
        XCTAssertEqual(ai.callCount, 1)
        XCTAssertEqual(scheduler.scheduled.filter { $0.date != nil }.count, 3)
    }

    func testDoesNotCallTheAIWhenThePermissionRequestIsDenied() async {
        let ai = StubAI(); let repo = InMemoryRepo(); let scheduler = SpyScheduler()
        scheduler.status = .notDetermined
        scheduler.authorized = false
        let coordinator = makeCoordinator(ai: ai, repo: repo, scheduler: scheduler)

        await coordinator.runCycle(profile: utcProfile())

        XCTAssertEqual(scheduler.requestAuthorizationCallCount, 1)
        XCTAssertEqual(ai.callCount, 0)
        XCTAssertTrue(repo.stored.isEmpty)
    }

    func testStoresNothingWhenTheAIHasNothingToGroundAnySlotIn() async {
        let ai = StubAI(); ai.result = GeneratedMirrorEchoes(morning: nil, afternoon: nil, evening: nil)
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
