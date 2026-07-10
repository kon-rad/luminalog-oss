import Foundation

/// The owner's authed Soul payload from `GET /v1/soul`. Coordinates are in the
/// unit cube [-1, 1]; `date`/`dayIndex` are fine here (owner's own data). Any
/// extra server fields (e.g. `nft`) are ignored by Codable — this surface is
/// read-only galaxy + stats.
struct SoulPayload: Codable, Equatable {
    let constellation: Constellation
    let stats: SoulStats
    /// The custodial wallet, present as soon as it is provisioned — before and
    /// independent of minting. nil only until the wallet exists.
    let wallet: SoulWallet?
    /// The minted soulbound token; nil until minted.
    let nft: SoulNft?

    enum CodingKeys: String, CodingKey { case constellation, stats, wallet, nft }

    init(constellation: Constellation, stats: SoulStats, wallet: SoulWallet? = nil, nft: SoulNft?) {
        self.constellation = constellation
        self.stats = stats
        self.wallet = wallet
        self.nft = nft
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        constellation = try c.decode(Constellation.self, forKey: .constellation)
        stats = try c.decode(SoulStats.self, forKey: .stats)
        // Lenient: a malformed/partial wallet or nft must never break the galaxy payload.
        wallet = (try? c.decodeIfPresent(SoulWallet.self, forKey: .wallet)) ?? nil
        nft = (try? c.decodeIfPresent(SoulNft.self, forKey: .nft)) ?? nil
    }

    /// The custodial wallet address, from the top-level wallet (available pre-mint)
    /// falling back to the minted nft. nil when no wallet exists yet.
    var walletAddress: String? {
        if let a = wallet?.address, !a.isEmpty { return a }
        if let a = nft?.walletAddress, !a.isEmpty { return a }
        return nil
    }

    /// BaseScan address page for the custodial wallet, once a wallet exists.
    var walletExplorerURL: URL? {
        wallet?.explorerURL ?? nft?.walletExplorerURL
    }
}

/// The custodial wallet backing the user's LuminaSoul, surfaced as soon as it is
/// provisioned (independent of whether the soulbound token has minted yet).
struct SoulWallet: Codable, Equatable {
    let address: String
    let chain: String?

    /// Short display form, e.g. `0x31Ca…f2fc`.
    var shortAddress: String {
        guard address.count > 12 else { return address }
        return "\(address.prefix(6))…\(address.suffix(4))"
    }

    /// The wallet's address page on the (Base Sepolia / Base) block explorer.
    var explorerURL: URL? {
        let sepolia = (chain ?? "base-sepolia").contains("sepolia")
        let host = sepolia ? "sepolia.basescan.org" : "basescan.org"
        return URL(string: "https://\(host)/address/\(address)")
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
        return URL(string: "https://\(explorerHost)/nft/\(contract)/\(tokenId)")
    }

    /// The custodial wallet's address page on the block explorer.
    var walletExplorerURL: URL? {
        guard let address = walletAddress else { return nil }
        return URL(string: "https://\(explorerHost)/address/\(address)")
    }

    /// `sepolia.basescan.org` on testnet, `basescan.org` on mainnet.
    private var explorerHost: String {
        (chain ?? "base-sepolia").contains("sepolia") ? "sepolia.basescan.org" : "basescan.org"
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
    let maxStreakCount: Int
    let totalWords: Int
    let goalDayWords: Int
}
