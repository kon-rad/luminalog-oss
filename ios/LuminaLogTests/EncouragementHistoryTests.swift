import XCTest
@testable import LuminaLog

/// Covers `recentDelivered`'s boundary and pagination rules against
/// `InMemoryEncouragementRepository`, which mirrors the Firestore query
/// (`deliveredAt <= now`, ordered descending) that the real repository runs.
@MainActor
final class EncouragementHistoryTests: XCTestCase {

    private func message(_ id: String, delivered: Date?) -> EncouragementMessage {
        EncouragementMessage(id: id, title: "T-\(id)", body: "B-\(id)", createdAt: Date(timeIntervalSince1970: 0), deliveredAt: delivered)
    }

    func testExcludesMessagesNotYetDelivered() async throws {
        let repo = InMemoryEncouragementRepository()
        try await repo.save([message("a", delivered: nil)])

        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let result = try await repo.recentDelivered(limit: 20, before: now, after: nil)

        XCTAssertTrue(result.isEmpty)
    }

    func testExcludesMessagesScheduledForLaterToday() async throws {
        let repo = InMemoryEncouragementRepository()
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let future = now.addingTimeInterval(3600)
        try await repo.save([message("a", delivered: future)])

        let result = try await repo.recentDelivered(limit: 20, before: now, after: nil)

        XCTAssertTrue(result.isEmpty, "a message armed for a slot later today must not appear as history yet")
    }

    func testOrdersMostRecentlyDeliveredFirst() async throws {
        let repo = InMemoryEncouragementRepository()
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        try await repo.save([
            message("morning", delivered: now.addingTimeInterval(-7200)),
            message("afternoon", delivered: now.addingTimeInterval(-3600)),
            message("yesterday", delivered: now.addingTimeInterval(-90_000)),
        ])

        let result = try await repo.recentDelivered(limit: 20, before: now, after: nil)

        XCTAssertEqual(result.map(\.id), ["afternoon", "morning", "yesterday"])
    }

    func testPaginatesByTheLastDeliveredAtCursor() async throws {
        let repo = InMemoryEncouragementRepository()
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        try await repo.save([
            message("newest", delivered: now.addingTimeInterval(-100)),
            message("middle", delivered: now.addingTimeInterval(-200)),
            message("oldest", delivered: now.addingTimeInterval(-300)),
        ])

        let firstPage = try await repo.recentDelivered(limit: 1, before: now, after: nil)
        XCTAssertEqual(firstPage.map(\.id), ["newest"])

        let secondPage = try await repo.recentDelivered(limit: 1, before: now, after: firstPage.last?.deliveredAt)
        XCTAssertEqual(secondPage.map(\.id), ["middle"])

        let thirdPage = try await repo.recentDelivered(limit: 1, before: now, after: secondPage.last?.deliveredAt)
        XCTAssertEqual(thirdPage.map(\.id), ["oldest"])

        let fourthPage = try await repo.recentDelivered(limit: 1, before: now, after: thirdPage.last?.deliveredAt)
        XCTAssertTrue(fourthPage.isEmpty)
    }
}
