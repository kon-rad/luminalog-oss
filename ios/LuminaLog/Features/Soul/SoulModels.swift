import Foundation

/// The owner's authed Soul payload from `GET /v1/soul`. Coordinates are in the
/// unit cube [-1, 1]; `date`/`dayIndex` are fine here (owner's own data). Any
/// extra server fields (e.g. `nft`) are ignored by Codable — this surface is
/// read-only galaxy + stats.
struct SoulPayload: Codable, Equatable {
    let constellation: Constellation
    let stats: SoulStats
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
