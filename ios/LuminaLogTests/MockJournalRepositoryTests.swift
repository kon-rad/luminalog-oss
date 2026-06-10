import XCTest
@testable import LuminaLog

/// The mock repository must re-emit on its streams when data changes.
/// Tests run on the main actor because the mocks are `@MainActor` (matching
/// the service protocols).
final class MockJournalRepositoryTests: XCTestCase {

    @MainActor
    func testSaveEmitsUpdatedRecentEntries() async throws {
        let existing = JournalEntry(
            id: "old",
            userId: "user-1",
            type: .text,
            title: "Older entry",
            createdAt: Date(timeIntervalSinceNow: -86_400),
            updatedAt: Date(timeIntervalSinceNow: -86_400),
            content: "Yesterday.",
            wordCount: 1
        )
        let repository = MockJournalRepository(entries: [existing])

        var iterator = repository.recentEntries(limit: 10).makeAsyncIterator()

        let initial = await iterator.next()
        XCTAssertEqual(initial?.map(\.id), ["old"])

        let new = JournalEntry(
            id: "new",
            userId: "user-1",
            type: .text,
            title: "Fresh entry",
            createdAt: Date(),
            updatedAt: Date(),
            content: "Today.",
            wordCount: 1
        )
        try await repository.save(new)

        let afterSave = await iterator.next()
        XCTAssertEqual(afterSave?.map(\.id), ["new", "old"], "Newest entry should be first")

        try await repository.delete(id: "new")
        let afterDelete = await iterator.next()
        XCTAssertEqual(afterDelete?.map(\.id), ["old"])
    }

    @MainActor
    func testEntryStreamEmitsOnUpdate() async throws {
        let entry = JournalEntry(
            id: "e1",
            userId: "user-1",
            type: .text,
            title: "Before",
            content: "v1",
            wordCount: 1
        )
        let repository = MockJournalRepository(entries: [entry])

        var iterator = repository.entry(id: "e1").makeAsyncIterator()
        let initial = await iterator.next()
        XCTAssertEqual(initial??.title, "Before")

        var updated = entry
        updated.title = "After"
        try await repository.save(updated)

        let next = await iterator.next()
        XCTAssertEqual(next??.title, "After")
    }

    @MainActor
    func testPaginationReturnsOnlyOlderEntries() async throws {
        let now = Date()
        let entries = (0..<5).map { index in
            JournalEntry(
                id: "e\(index)",
                userId: "user-1",
                type: .text,
                title: "Entry \(index)",
                createdAt: now.addingTimeInterval(TimeInterval(-index) * 3_600),
                updatedAt: now,
                content: "",
                wordCount: 0
            )
        }
        let repository = MockJournalRepository(entries: entries)

        let firstPage = try await repository.entries(after: nil, limit: 2)
        XCTAssertEqual(firstPage.map(\.id), ["e0", "e1"])

        let secondPage = try await repository.entries(after: firstPage.last?.createdAt, limit: 2)
        XCTAssertEqual(secondPage.map(\.id), ["e2", "e3"])
    }
}
