import Foundation

// Swift mirror of the Cognitive Map contract.
//
// CANONICAL DEFINITION: packages/cognitive-map/src/types.ts. This file duplicates it
// deliberately: the shared package is TypeScript and iOS cannot import it, so the
// contract is expressed once per language and guarded by a shared fixture that all
// three test suites decode. Same reasoning as the AAD context strings.
//
// Naming: the graph edge is `MapEdge` and the life area is `LifeDomain`, because
// `Edge` is a SwiftUI type and shadowing it produces confusing errors in any file
// that imports SwiftUI. The JSON keys are unchanged, so the wire contract matches.
//
// Pure domain model: no Firebase, no crypto, no SwiftUI. Persistence mapping lives in
// Core/Persistence.

/// What kind of thing a beat is. Drives SHAPE on the map, and nothing else.
enum BeatKind: String, Codable, CaseIterable, Sendable {
    case event
    case feeling
    case belief
    case intent
}

/// Which area of life a beat belongs to. Drives COLOR on the map, and nothing else.
enum LifeDomain: String, Codable, CaseIterable, Sendable {
    case craft
    case body
    case people
    case place
    case mind
    case money
    case other
}

/// Whether a beat is drawn. `ledger` beats are stored and decryptable but never
/// rendered; they are the raw material the entity registry and threads will use.
enum BeatTier: String, Codable, Sendable {
    case map
    case ledger
}

enum EdgeType: String, Codable, CaseIterable, Sendable {
    case caused
    case because
    case contradicts
    case counters
    case evidenceFor = "evidence_for"
    case partOf = "part_of"
}

enum MentionType: String, Codable, CaseIterable, Sendable {
    case person
    case project
    case place
    case practice
    case org
}

/// An entity mentioned in a beat, as the writer wrote it. v1 stores the surface form
/// only: resolving "Marcus", "M" and "my cofounder" to one person needs a registry
/// that spans entries, which is the next phase.
struct Mention: Codable, Equatable, Sendable {
    var surface: String
    var type: MentionType
}

/// One unit of meaning inside an entry.
struct Beat: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var tier: BeatTier
    var kind: BeatKind
    /// 3 to 7 words. The label on the node.
    var text: String
    /// Verified exact substring of the entry's content. The server drops any beat
    /// whose quote is not found verbatim, so this can be trusted to locate real text.
    var quote: String
    /// UTF-16 offset of `quote` in the entry's content.
    var quoteStart: Int
    var domain: LifeDomain
    var isSpine: Bool
    var isKeeper: Bool
    var generality: Double
    var keepScore: Double
    var degree: Int
    var mentions: [Mention]
}

/// A labeled, polarised connection between two beats in the same entry.
struct MapEdge: Codable, Equatable, Sendable {
    var from: String
    var to: String
    var type: EdgeType
    /// Display label, 1 or 2 words: "drained", "lifted".
    var phrasing: String
    /// +1 strengthens, -1 weakens, 0 neither.
    var polarity: Int
}

/// The whole map for one entry, as stored (encrypted) on the journal document.
struct CognitiveMap: Codable, Equatable, Sendable {
    var v: Int
    var beats: [Beat]
    var edges: [MapEdge]

    /// Only these are drawn. Ledger beats are carried for the cross-entry work.
    var drawnBeats: [Beat] { beats.filter { $0.tier == .map } }

    func beat(id: String) -> Beat? { beats.first { $0.id == id } }
}

/// The stored field: the map plus the metadata that stays plaintext in Firestore,
/// mirroring `AIGeneration`.
///
/// `Codable` because `JournalEntry` is, and every stored property of a Codable type
/// must be too. The Firestore representation is NOT this synthesized encoding: see
/// `firestoreData(cipher:)` in FirestoreMapping, which seals `map` into an envelope.
struct CognitiveMapGeneration: Codable, Equatable, Sendable {
    var map: CognitiveMap
    var generatedAt: Date
    var model: String
    /// Schema plus extraction version. Bump to force re-extraction of every entry.
    var version: Int

    static let currentVersion = 1

    init(
        map: CognitiveMap,
        generatedAt: Date = Date(),
        model: String = "",
        version: Int = CognitiveMapGeneration.currentVersion
    ) {
        self.map = map
        self.generatedAt = generatedAt
        self.model = model
        self.version = version
    }
}
