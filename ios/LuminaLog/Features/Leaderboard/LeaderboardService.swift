import Foundation

/// Fetches the global leaderboards from the proxy API.
protocol LeaderboardService {
    func fetch() async throws -> Leaderboards
}

/// Live implementation backed by `GET /v1/leaderboards`.
final class ProxyLeaderboardService: LeaderboardService {
    private let api: ProxyAPIClient

    init(api: ProxyAPIClient) {
        self.api = api
    }

    func fetch() async throws -> Leaderboards {
        try await api.get(path: "/v1/leaderboards")
    }
}

/// Mock for previews and unit tests.
final class MockLeaderboardService: LeaderboardService {
    var result: Result<Leaderboards, Error>

    init(result: Result<Leaderboards, Error> = .success(Leaderboards(streak: [], words: []))) {
        self.result = result
    }

    func fetch() async throws -> Leaderboards {
        try result.get()
    }
}
