import Foundation

/// The owner's authed Soul payload from `GET /v1/soul`. Coordinates are in the
/// unit cube [-1, 1]; `date`/`dayIndex` are fine here (owner's own data). Any
/// extra server fields (e.g. `nft`) are ignored by Codable — this surface is
/// read-only galaxy + stats.
struct SoulPayload: Codable, Equatable {
    let constellation: Constellation
    let stats: SoulStats
    /// The minted soulbound token + custodial wallet; nil until minted.
    let nft: SoulNft?

    enum CodingKeys: String, CodingKey { case constellation, stats, nft }

    init(constellation: Constellation, stats: SoulStats, nft: SoulNft?) {
        self.constellation = constellation
        self.stats = stats
        self.nft = nft
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        constellation = try c.decode(Constellation.self, forKey: .constellation)
        stats = try c.decode(SoulStats.self, forKey: .stats)
        // Lenient: a malformed/partial nft must never break the galaxy payload.
        nft = (try? c.decodeIfPresent(SoulNft.self, forKey: .nft)) ?? nil
    }
}

struct SoulNft: Codable, Equatable {
    let tokenId: String
    let contract: String
    let chain: String?
    let walletAddress: String?
    let txHash: String?

    /// Short display form of the wallet, e.g. `0x31Ca…f2fc`.
    var shortWallet: String? {
        guard let a = walletAddress, a.count > 12 else { return walletAddress }
        return "\(a.prefix(6))…\(a.suffix(4))"
    }

    /// The token's page on the (Base Sepolia / Base) block explorer.
    var explorerURL: URL? {
        let sepolia = (chain ?? "base-sepolia").contains("sepolia")
        let host = sepolia ? "sepolia.basescan.org" : "basescan.org"
        return URL(string: "https://\(host)/nft/\(contract)/\(tokenId)")
    }
}

struct Constellation: Codable, Equatable {
    let version: Int
    let points: [ConstellationPoint]
}

struct ConstellationPoint: Codable, Equatable {
    let dayIndex: Int
    let date: String
    let x: Double
    let y: Double
    let z: Double
    let wordCount: Int
    let streakAtEarn: Int
}

struct SoulStats: Codable, Equatable {
    let streakCount: Int
    let totalWords: Int
    let goalDayWords: Int
}
