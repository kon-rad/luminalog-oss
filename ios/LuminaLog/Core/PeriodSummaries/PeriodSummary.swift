import Foundation

/// One stored period summary, decrypted. Firestore doc
/// `periodSummaries/{uid}/tiers/{key.docId}`; `title`, `sentence` and `summary` are
/// sealed (AAD `periodSummaries.title` / `.sentence` / `.summary`), `details` is one
/// sealed JSON value (AAD `periodSummaries.details`), the rest is plaintext
/// metadata. Mapping lives in `FirestoreMapping.swift`.
struct PeriodSummary: Equatable, Sendable {
    let key: PeriodKey
    /// 2 to 6 words, a chapter-style name ("The Forest City move"). Shown where a
    /// sentence won't fit: accordion rows, breadcrumbs, map captions.
    var title: String
    var sentence: String
    var summary: String
    var generatedAt: Date
    /// Inputs it was built from (entries for a day, child periods above that).
    var sourceCount: Int
    /// SHA-256 of its inputs' ids and stamps; see `PeriodSummaryPlanner.fingerprint`.
    var sourceFingerprint: String
    /// The period had not ended when this was generated ("so far").
    var isOpen: Bool
    var model: String
    var promptVersion: Int
    /// Salience, anchors, key scenes, threads. Last, with a default, so fixtures
    /// that don't care can omit it.
    var details: PeriodSummaryDetails = .empty
}

/// A verbatim quote from one entry, checked server-side against the inputs.
/// Always points at an entry, at every tier (higher tiers carry their children's).
struct PeriodSummaryAnchor: Codable, Equatable, Sendable {
    let entryId: String
    let quote: String
}

/// Entry ids of the period's high point, low point, and turning point, when the
/// model saw a clear one.
struct PeriodSummaryKeyScenes: Codable, Equatable, Sendable {
    let high: String?
    let low: String?
    let turning: String?

    static let none = PeriodSummaryKeyScenes(high: nil, low: nil, turning: nil)
}

/// The grounding half of a summary (spec, "Grounding details"). Sealed as one JSON
/// value under AAD `periodSummaries.details`.
struct PeriodSummaryDetails: Codable, Equatable, Sendable {
    /// 1 to 10; nil only for a doc stored without details.
    let salience: Int?
    let anchors: [PeriodSummaryAnchor]
    let keyScenes: PeriodSummaryKeyScenes
    /// Short, stable topic labels ("Argo launch"); parents reuse children's labels.
    let threads: [String]

    static let empty = PeriodSummaryDetails(salience: nil, anchors: [], keyScenes: .none, threads: [])
}

/// One input for a period summary. For a day: an entry (`id` is the entry id,
/// `text` its summary or the start of its content, `excerpt` the start of its
/// content in the user's own words). Above a day: a child period (`id` is its doc
/// id, `text` its summary, plus its salience, anchors, and threads). Mirrors
/// `PeriodSummaryChild` in `server/src/services/periodSummary.ts`; nil optionals
/// are omitted from the JSON.
struct PeriodSummaryChildInput: Codable, Equatable, Sendable {
    let id: String
    let label: String
    let text: String
    let excerpt: String?
    let salience: Int?
    let anchors: [PeriodSummaryAnchor]
    let threads: [String]

    init(id: String, label: String, text: String, excerpt: String? = nil, salience: Int? = nil,
         anchors: [PeriodSummaryAnchor] = [], threads: [String] = []) {
        self.id = id
        self.label = label
        self.text = text
        self.excerpt = excerpt
        self.salience = salience
        self.anchors = anchors
        self.threads = threads
    }
}

/// `POST /v1/ai/period-summary` body. PLAINTEXT, built on device; the server
/// forgets it after replying.
struct PeriodSummaryRequest: Encodable, Equatable, Sendable {
    let periodType: String
    let periodLabel: String
    let isOpen: Bool
    let children: [PeriodSummaryChildInput]
}

/// `POST /v1/ai/period-summary` response. Anchors and key scenes arrive already
/// grounded (the server drops any it cannot trace to the request).
struct GeneratedPeriodSummary: Decodable, Equatable, Sendable {
    let title: String
    let sentence: String
    let summary: String
    let salience: Int
    let anchors: [PeriodSummaryAnchor]
    let keyScenes: PeriodSummaryKeyScenes
    let threads: [String]
    let model: String

    var details: PeriodSummaryDetails {
        PeriodSummaryDetails(salience: salience, anchors: anchors, keyScenes: keyScenes, threads: threads)
    }
}

/// The one AI call the reconciler needs. A narrow protocol (not `AIService`) so
/// tests stub a single method. `ProxyAIService` conforms.
protocol PeriodSummaryGenerating: AnyObject {
    func generatePeriodSummary(_ request: PeriodSummaryRequest) async throws -> GeneratedPeriodSummary
}
