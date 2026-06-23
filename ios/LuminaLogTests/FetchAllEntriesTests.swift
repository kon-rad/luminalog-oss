import XCTest
@testable import LuminaLog

final class FetchAllEntriesTests: XCTestCase {

    @MainActor
    func testFetchAllEntriesReturnsEverythingNewestFirst() async throws {
        let now = Date()
        let older = JournalEntry(id: "a", userId: "u", type: .text, title: "A",
                                 createdAt: now.addingTimeInterval(-3600), content: "older")
        let newer = JournalEntry(id: "b", userId: "u", type: .voice, title: "B",
                                 createdAt: now, content: "newer")
        let repo = MockJournalRepository(entries: [older, newer])

        let all = try await repo.fetchAllEntries()

        XCTAssertEqual(all.map(\.id), ["b", "a"])
    }

    @MainActor
    func testFetchAllEntriesEmptyStoreReturnsEmpty() async throws {
        let repo = MockJournalRepository(entries: [])
        let all = try await repo.fetchAllEntries()
        XCTAssertTrue(all.isEmpty)
    }
}
