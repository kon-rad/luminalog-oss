import XCTest
@testable import LuminaLog

@MainActor
final class LeaderboardViewModelTests: XCTestCase {

    private func entry(_ id: String, rank: Int, value: Int) -> LeaderboardEntry {
        LeaderboardEntry(rank: rank, userId: id, displayName: "U\(id)", photoURL: nil, value: value)
    }

    func testLoadPopulatesBothBoards() async {
        let boards = Leaderboards(
            streak: [entry("a", rank: 1, value: 9)],
            words: [entry("b", rank: 1, value: 900)]
        )
        let vm = LeaderboardViewModel(
            service: MockLeaderboardService(result: .success(boards)),
            currentUserId: "a"
        )
        await vm.load()
        XCTAssertEqual(vm.state, .loaded)
        XCTAssertEqual(vm.streak.map(\.userId), ["a"])
        XCTAssertEqual(vm.words.map(\.userId), ["b"])
    }

    func testEntriesFollowSelectedBoard() async {
        let boards = Leaderboards(
            streak: [entry("a", rank: 1, value: 9)],
            words: [entry("b", rank: 1, value: 900)]
        )
        let vm = LeaderboardViewModel(
            service: MockLeaderboardService(result: .success(boards)),
            currentUserId: nil
        )
        await vm.load()
        XCTAssertEqual(vm.entries.map(\.userId), ["a"]) // default = .streak
        vm.selected = .words
        XCTAssertEqual(vm.entries.map(\.userId), ["b"])
    }

    func testFailureSetsFailedState() async {
        struct Boom: Error {}
        let vm = LeaderboardViewModel(
            service: MockLeaderboardService(result: .failure(Boom())),
            currentUserId: nil
        )
        await vm.load()
        if case .failed = vm.state {} else { XCTFail("expected .failed, got \(vm.state)") }
    }

    func testIsCurrentUserMatchesByUserId() async {
        let vm = LeaderboardViewModel(
            service: MockLeaderboardService(),
            currentUserId: "me"
        )
        XCTAssertTrue(vm.isCurrentUser(entry("me", rank: 1, value: 1)))
        XCTAssertFalse(vm.isCurrentUser(entry("other", rank: 2, value: 1)))
    }
}
