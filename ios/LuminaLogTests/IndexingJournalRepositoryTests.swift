import XCTest
@testable import LuminaLog

/// Records the coordinator's lifecycle calls. `@MainActor` so its mutable state is
/// only ever touched on the main actor — the decorator's fire-and-forget `Task`
/// (created inside a `@MainActor` method) runs its `indexEntry`/`removeEntry` on
/// the main actor too, so there is no data race and the test can read the arrays
/// directly.
@MainActor
private final class RecordingCoordinator: SemanticIndexCoordinating {
    private(set) var indexed: [(id: String, text: String)] = []
    private(set) var removed: [String] = []

    func indexEntry(id: String, text: String) async throws { indexed.append((id, text)) }
    func removeEntry(id: String) async throws { removed.append(id) }
    func loadIndex() async throws {}
    func backfill(_ entries: [(id: String, text: String)]) async throws {}
    func search(query: String, k: Int) async throws -> [String] { [] }
}

/// Verifies the `IndexingJournalRepository` decorator fires (only when the flag is
/// ON) and otherwise passes through byte-identically.
@MainActor
final class IndexingJournalRepositoryTests: XCTestCase {

    override func tearDown() {
        DevFlags.aiModel1 = false   // never leak the flag into other suites
        super.tearDown()
    }

    private func makeEntry(id: String, content: String) -> JournalEntry {
        JournalEntry(id: id, userId: "u1", type: .text, title: "t",
                     createdAt: Date(timeIntervalSince1970: 1_700_000_000), content: content)
    }

    /// Poll until `condition` holds (letting the fire-and-forget Task run) or a
    /// short timeout elapses.
    private func waitUntil(_ condition: () -> Bool, timeout: TimeInterval = 2) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            try? await Task.sleep(nanoseconds: 5_000_000)   // 5ms
        }
    }

    // MARK: - Flag ON

    func testSaveIndexesEntryWhenFlagOn() async throws {
        DevFlags.aiModel1 = true
        let base = MockJournalRepository(entries: [])
        let coordinator = RecordingCoordinator()
        let repo = IndexingJournalRepository(base: base, coordinator: coordinator)

        try await repo.save(makeEntry(id: "e1", content: "a quiet morning walk"))

        await waitUntil { coordinator.indexed.count == 1 }
        XCTAssertEqual(coordinator.indexed.map(\.id), ["e1"])
        XCTAssertEqual(coordinator.indexed.first?.text, "a quiet morning walk")
        // Base write still happened.
        let stored = try await base.fetchAllEntries()
        XCTAssertEqual(stored.map(\.id), ["e1"])
    }

    func testApplyEntryEditReindexesWhenFlagOn() async throws {
        DevFlags.aiModel1 = true
        let base = MockJournalRepository(entries: [makeEntry(id: "e1", content: "old")])
        let coordinator = RecordingCoordinator()
        let repo = IndexingJournalRepository(base: base, coordinator: coordinator)

        try await repo.applyEntryEdit(
            id: "e1", title: "t", content: "new body", wordCount: 2,
            contentEditedAt: Date(), edit: EditRecord(fields: ["content"])
        )

        await waitUntil { !coordinator.indexed.isEmpty }
        XCTAssertEqual(coordinator.indexed.map(\.id), ["e1"])
        XCTAssertEqual(coordinator.indexed.first?.text, "new body")
    }

    func testDeleteRemovesFromIndexWhenFlagOn() async throws {
        DevFlags.aiModel1 = true
        let base = MockJournalRepository(entries: [makeEntry(id: "e1", content: "x")])
        let coordinator = RecordingCoordinator()
        let repo = IndexingJournalRepository(base: base, coordinator: coordinator)

        try await repo.delete(id: "e1")

        await waitUntil { !coordinator.removed.isEmpty }
        XCTAssertEqual(coordinator.removed, ["e1"])
    }

    // MARK: - Flag OFF (byte-identical pass-through)

    func testSaveDoesNotIndexWhenFlagOff() async throws {
        DevFlags.aiModel1 = false
        let base = MockJournalRepository(entries: [])
        let coordinator = RecordingCoordinator()
        let repo = IndexingJournalRepository(base: base, coordinator: coordinator)

        try await repo.save(makeEntry(id: "e1", content: "hello"))

        // Give any (erroneously scheduled) hook a chance to run, then assert none did.
        await waitUntil({ !coordinator.indexed.isEmpty }, timeout: 0.3)
        XCTAssertTrue(coordinator.indexed.isEmpty)
        // Base write still happened — behavior unchanged.
        let stored = try await base.fetchAllEntries()
        XCTAssertEqual(stored.map(\.id), ["e1"])
    }

    func testDeleteDoesNotRemoveWhenFlagOff() async throws {
        DevFlags.aiModel1 = false
        let base = MockJournalRepository(entries: [makeEntry(id: "e1", content: "x")])
        let coordinator = RecordingCoordinator()
        let repo = IndexingJournalRepository(base: base, coordinator: coordinator)

        try await repo.delete(id: "e1")

        await waitUntil({ !coordinator.removed.isEmpty }, timeout: 0.3)
        XCTAssertTrue(coordinator.removed.isEmpty)
    }
}
