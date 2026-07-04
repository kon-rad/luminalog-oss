import Foundation

/// Fetches the owner's Soul point-set + stats from the proxy API.
protocol SoulService {
    func fetchSoul() async throws -> SoulPayload
}

/// Live implementation backed by `GET /v1/soul`.
final class ProxySoulService: SoulService {
    private let api: ProxyAPIClient
    init(api: ProxyAPIClient) { self.api = api }

    func fetchSoul() async throws -> SoulPayload {
        try await api.get(path: "/v1/soul")
    }
}

/// Mock for previews and unit tests.
final class MockSoulService: SoulService {
    var result: Result<SoulPayload, Error>
    init(result: Result<SoulPayload, Error> = .success(.sample)) { self.result = result }
    func fetchSoul() async throws -> SoulPayload { try result.get() }
}

extension SoulPayload {
    /// A small populated galaxy for previews/tests.
    static var sample: SoulPayload {
        let pts = (0..<12).map { i -> ConstellationPoint in
            let t = Double(i) / 12.0 * .pi * 2
            return ConstellationPoint(
                dayIndex: 20000 + i,
                date: "2026-06-\(String(format: "%02d", i + 1))",
                x: cos(t) * 0.6, y: sin(t * 1.3) * 0.5, z: Double((i * 3) % 7) / 7 - 0.5,
                wordCount: 760 + i * 40, streakAtEarn: i + 1)
        }
        return SoulPayload(
            constellation: Constellation(version: 3, points: pts),
            stats: SoulStats(streakCount: 5, maxStreakCount: 15, totalWords: 12480, goalDayWords: 420),
            nft: SoulNft(tokenId: "2", contract: "0xd4889dd3a9fc8dcf962a09146a01befc910404fd",
                         chain: "base-sepolia",
                         walletAddress: "0x31Ca2F5af812b33EfC9C366a7D233FaD1E7df2fc", txHash: nil))
    }

    /// A nascent (empty) soul.
    static var empty: SoulPayload {
        SoulPayload(constellation: Constellation(version: 0, points: []),
                    stats: SoulStats(streakCount: 0, maxStreakCount: 0, totalWords: 0, goalDayWords: 0),
                    nft: nil)
    }
}
