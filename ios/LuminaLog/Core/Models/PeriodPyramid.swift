import Foundation

/// One tier's positioned dot, as returned by `GET /v1/ai/period-positions/:periodType`.
/// Mirrors `PeriodPositionPoint` in `server/src/services/periodCentroid/rollup.ts`.
/// `Codable`, not just `Decodable`: it is decoded from the route response AND
/// re-encoded by `ZoomPyramidWebView`'s `encodableToObject` to push into the
/// renderer's `setTierData` bridge call.
struct PeriodPositionPoint: Codable, Equatable, Sendable {
    let periodIndex: Int
    let x: Double
    let y: Double
    let z: Double
    let childCount: Int
    let parentIndex: Int?
}

/// One beat's plaintext projection, sent to the server for narrative synthesis.
/// Mirror of `server/src/services/periodNarrative/index.ts` `BeatInput`.
struct PeriodNarrativeBeatInput: Encodable {
    let text: String
    let kind: String
    let domain: String
    let isSpine: Bool
}

/// One day's worth of beats, sent to the server for narrative synthesis.
/// Mirror of `server/src/services/periodNarrative/index.ts` `DayInput`.
struct PeriodNarrativeDayInput: Encodable {
    let dayIndex: Int
    let beats: [PeriodNarrativeBeatInput]
}