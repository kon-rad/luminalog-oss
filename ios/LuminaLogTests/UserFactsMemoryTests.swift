import XCTest
@testable import LuminaLog

final class UserFactsMemoryTests: XCTestCase {

    private typealias F = UserFactFixtures

    func testListsCurrentFactsUsersFirstThenMostRecent() {
        let block = UserFactsMemory.block(facts: [
            F.fact("a", category: .place, statement: "You live in Forest City.", lastConfirmed: "2026-09-20T10:00:00Z"),
            F.fact("b", category: .person, statement: "Maya is my sister.", userAuthored: true, lastConfirmed: "2026-01-01T10:00:00Z"),
            F.fact("c", category: .goal, statement: "You want to run a marathon.", lastConfirmed: "2026-09-25T10:00:00Z"),
            F.fact("old", statement: "Old.", status: .invalidated),
            F.fact("tomb", statement: "Deleted.", status: .rejected),
        ])
        XCTAssertEqual(block, """
        What they have told you about their life (current; they can edit this list):
        - Person: Maya is my sister.
        - Goal: You want to run a marathon.
        - Place: You live in Forest City.
        """)
    }

    func testCapsTheNumberOfLines() {
        let facts = (1...40).map { F.fact("f\($0)") }
        let lines = UserFactsMemory.block(facts: facts, limit: 30)?.split(separator: "\n") ?? []
        XCTAssertEqual(lines.count, 31)
    }

    func testNilWhenThereIsNothingCurrent() {
        XCTAssertNil(UserFactsMemory.block(facts: []))
        XCTAssertNil(UserFactsMemory.block(facts: [F.fact("x", status: .rejected)]))
    }
}
