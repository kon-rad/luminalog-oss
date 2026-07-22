import XCTest
@testable import LuminaLog

/// Fixed-token provider so `ProxyAPIClient` can build authed requests offline.
private final class PrimingStubTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

/// Recording `SemanticIndexCoordinating` fake that can fail `loadIndex` a configurable
/// number of times before succeeding, so we can assert the retry / latch behavior of
/// `primeSemanticIndexIfNeeded`.
private final class RecordingPrimingCoordinator: SemanticIndexCoordinating, @unchecked Sendable {
    private(set) var loadCallCount = 0
    private(set) var backfillCallCount = 0
    private(set) var backfilledIds: [String] = []
    /// `loadIndex` throws until this many calls have been made.
    var loadFailuresBeforeSuccess = 0

    func indexEntry(id: String, text: String) async throws {}
    func removeEntry(id: String) async throws {}
    func loadIndex() async throws {
        loadCallCount += 1
        if loadCallCount <= loadFailuresBeforeSuccess {
            throw SemanticIndexError.keyUnavailable
        }
    }
    func backfill(_ entries: [(id: String, text: String)]) async throws {
        backfillCallCount += 1
        backfilledIds.append(contentsOf: entries.map { $0.id })
    }
    func search(query: String, k: Int) async throws -> [String] { [] }
}

/// Verifies the reliability fix: a transient priming failure must not poison the
/// session (the next Model-1 call retries), a successful prime is a one-shot, and
/// concurrent first calls single-flight into one pass. Driven through
/// `voiceCallContext` — the lightest public Model-1 path that primes (no network).
final class ProxyAIServicePrimingTests: XCTestCase {

    private var savedFlag = false

    override func setUp() {
        super.setUp()
        savedFlag = DevFlags.aiModel1
        DevFlags.aiModel1 = true
    }

    override func tearDown() {
        DevFlags.aiModel1 = savedFlag   // never leak the flag into other suites
        super.tearDown()
    }

    /// Entries dated in 1970 so they always count as PAST (never "today"), which is
    /// what `voiceCallContext` feeds into priming's backfill.
    private func pastEntries() -> [JournalEntry] {
        [
            JournalEntry(id: "e1", userId: "u", type: .text, title: "A",
                         createdAt: Date(timeIntervalSince1970: 0), content: "alpha"),
            JournalEntry(id: "e2", userId: "u", type: .text, title: "B",
                         createdAt: Date(timeIntervalSince1970: 0), content: "beta"),
        ]
    }

    @MainActor
    private func makeService(entries: [JournalEntry], coordinator: SemanticIndexCoordinating) -> ProxyAIService {
        let config = URLSessionConfiguration.ephemeral
        let session = URLSession(configuration: config)
        let api = ProxyAPIClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: PrimingStubTokenProvider(),
            session: session
        )
        return ProxyAIService(
            api: api,
            journals: MockJournalRepository(entries: entries),
            profiles: MockProfileRepository(),
            coordinator: coordinator
        )
    }

    @MainActor
    func testTransientLoadFailureDoesNotLatchAndRetries() async throws {
        let coordinator = RecordingPrimingCoordinator()
        coordinator.loadFailuresBeforeSuccess = 1   // first loadIndex throws, then succeeds
        let service = makeService(entries: pastEntries(), coordinator: coordinator)

        // First call: loadIndex throws (must NOT latch); backfill still runs once.
        _ = try? await service.voiceCallContext(journalId: nil)
        XCTAssertEqual(coordinator.loadCallCount, 1)
        XCTAssertEqual(coordinator.backfillCallCount, 1)

        // Second call: because the failed load did not latch, it retries — and now
        // succeeds. Backfill already succeeded, so it is not repeated.
        _ = try? await service.voiceCallContext(journalId: nil)
        XCTAssertEqual(coordinator.loadCallCount, 2, "a failed load must be retried, not poisoned")
        XCTAssertEqual(coordinator.backfillCallCount, 1, "a succeeded backfill is not repeated")

        // Third call: both steps now latched → fully a no-op.
        _ = try? await service.voiceCallContext(journalId: nil)
        XCTAssertEqual(coordinator.loadCallCount, 2)
        XCTAssertEqual(coordinator.backfillCallCount, 1)
    }

    @MainActor
    func testSuccessfulPrimeIsOneShot() async throws {
        let coordinator = RecordingPrimingCoordinator()
        let service = makeService(entries: pastEntries(), coordinator: coordinator)

        _ = try? await service.voiceCallContext(journalId: nil)
        _ = try? await service.voiceCallContext(journalId: nil)
        _ = try? await service.voiceCallContext(journalId: nil)

        XCTAssertEqual(coordinator.loadCallCount, 1, "load runs once on success")
        XCTAssertEqual(coordinator.backfillCallCount, 1, "backfill runs once on success")
        XCTAssertEqual(Set(coordinator.backfilledIds), ["e1", "e2"])
    }

    @MainActor
    func testWarmSemanticIndexPrimesOffTheRequestPath() async {
        let coordinator = RecordingPrimingCoordinator()
        let service = makeService(entries: pastEntries(), coordinator: coordinator)

        await service.warmSemanticIndex()
        XCTAssertEqual(coordinator.loadCallCount, 1)
        XCTAssertEqual(coordinator.backfillCallCount, 1)
        XCTAssertEqual(Set(coordinator.backfilledIds), ["e1", "e2"])

        // Shares the latch with the on-demand path: a later request is a no-op.
        _ = try? await service.voiceCallContext(journalId: nil)
        XCTAssertEqual(coordinator.loadCallCount, 1)
        XCTAssertEqual(coordinator.backfillCallCount, 1)
    }

    @MainActor
    func testConcurrentFirstCallsPrimeOnce() async throws {
        let coordinator = RecordingPrimingCoordinator()
        let service = makeService(entries: pastEntries(), coordinator: coordinator)

        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<3 {
                group.addTask { @MainActor in
                    _ = try? await service.voiceCallContext(journalId: nil)
                }
            }
        }

        XCTAssertEqual(coordinator.loadCallCount, 1, "single-flight: three concurrent calls prime once")
        XCTAssertEqual(coordinator.backfillCallCount, 1)
    }
}
