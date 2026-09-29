import Foundation

/// What a fact is about. Raw values are the Firestore and wire names, shared with
/// `USER_FACT_CATEGORIES` in `server/src/services/userFacts.ts`. `allCases` order is
/// the section order on screen.
enum UserFactCategory: String, Codable, CaseIterable, Sendable {
    case person, place, work, goal, value, preference, struggle, commitment, lifeEvent

    /// Section title in "What Argo knows".
    var label: String {
        switch self {
        case .person: return "People"
        case .place: return "Places"
        case .work: return "Work and projects"
        case .goal: return "Goals"
        case .value: return "Values"
        case .preference: return "Preferences"
        case .struggle: return "Struggles"
        case .commitment: return "Commitments"
        case .lifeEvent: return "Life events"
        }
    }

    /// Singular, for the editor's picker and the voice memory block.
    var singular: String {
        switch self {
        case .person: return "Person"
        case .place: return "Place"
        case .work: return "Work or project"
        case .goal: return "Goal"
        case .value: return "Value"
        case .preference: return "Preference"
        case .struggle: return "Struggle"
        case .commitment: return "Commitment"
        case .lifeEvent: return "Life event"
        }
    }

    var systemImage: String {
        switch self {
        case .person: return "person.2"
        case .place: return "mappin.and.ellipse"
        case .work: return "briefcase"
        case .goal: return "flag"
        case .value: return "heart"
        case .preference: return "hand.thumbsup"
        case .struggle: return "cloud.rain"
        case .commitment: return "checkmark.seal"
        case .lifeEvent: return "star"
        }
    }
}

enum UserFactStatus: String, Codable, Sendable {
    /// True now, as far as Argo knows.
    case active
    /// Was true, then stopped (`validTo` is set). Kept, never deleted: the change is the story.
    case invalidated
    /// The user deleted it. A tombstone, kept so extraction never proposes it again.
    case rejected
}

enum UserFactOrigin: String, Codable, Sendable {
    case extracted
    case user
}

/// A change extraction wanted to make to a fact the user owns. Shown as "Argo
/// noticed"; applied only if the user accepts. Stored sealed (AAD `userFacts.proposal`).
struct UserFactProposal: Codable, Equatable, Sendable {
    enum Kind: String, Codable, Sendable { case update, invalidate }
    var kind: Kind
    var statement: String?
    var validTo: Date?
    var reason: String?
    var evidence: [String]
}

/// One stored fact, decrypted. Firestore doc `userFacts/{uid}/facts/{id}`; `category`,
/// `subject`, `statement` and `proposal` are sealed, the rest is plaintext metadata. Mapping lives
/// in `FirestoreMapping.swift`. Spec: docs/superpowers/specs/2026-09-28-user-facts-design.md.
struct UserFact: Identifiable, Equatable, Sendable {
    let id: String
    var category: UserFactCategory
    /// The person, place or thing, 1 to 5 words. May be empty for a fact the user added.
    var subject: String
    /// One second-person sentence ("Maya is your younger sister.").
    var statement: String
    var status: UserFactStatus
    var origin: UserFactOrigin
    /// True once the user created, edited, ended, restored, deleted or accepted a change
    /// to it. Extraction may then only add evidence or leave a proposal.
    var userAuthored: Bool
    /// Entry ids this rests on, oldest first, newest 20 kept.
    var evidence: [String]
    /// Earliest and latest cited entry (creation time for a fact the user added).
    var firstObservedAt: Date
    var lastConfirmedAt: Date
    /// When it was true in the user's life. nil `validFrom` = unknown; nil `validTo` = still true.
    var validFrom: Date?
    var validTo: Date?
    /// The fact that replaced this one, when both came from the same batch.
    var supersededBy: String?
    var proposal: UserFactProposal?
    var createdAt: Date
    var updatedAt: Date
    var model: String
    var promptVersion: Int
}

/// Plaintext bookkeeping at `userFacts/{uid}/state/extraction`.
struct UserFactExtractionState: Equatable, Sendable {
    /// Entry id to the stamp (`contentEditedAt ?? createdAt`, ms) it was read at.
    var processed: [String: Int64] = [:]
    /// Failed batches that included the entry. Solo at 2, skipped at 4.
    var failures: [String: Int] = [:]
    /// Entry id to the stamp it was given up at. Retried once it is edited.
    var skipped: [String: Int64] = [:]
    /// "Learn from my journal".
    var learning: Bool = true
    var promptVersion: Int = 0
}

// MARK: - Wire contract (POST /v1/ai/user-facts)

/// One entry in the request. PLAINTEXT, built on device; the server forgets it.
struct UserFactsEntryInput: Encodable, Equatable, Sendable {
    let id: String
    /// Local `yyyy-MM-dd`, a hint for the model. Stored dates come from `createdAt`.
    let date: String
    let title: String
    let text: String
}

struct KnownFactInput: Encodable, Equatable, Sendable {
    /// Short ref (`f1`...) the ops point back at. Mapped to a fact id on device.
    let ref: String
    let category: String
    let subject: String
    let statement: String
    let since: String?
    let userAuthored: Bool
}

struct RejectedFactInput: Encodable, Equatable, Sendable {
    let category: String
    let statement: String
}

struct UserFactsRequest: Encodable, Equatable, Sendable {
    let entries: [UserFactsEntryInput]
    let facts: [KnownFactInput]
    let rejected: [RejectedFactInput]
}

/// One op from the server. `op` and `category` are Strings, not enums, so a newer
/// server adding a kind can't break decoding for this build: the merger ignores
/// what it does not know.
struct UserFactOperation: Decodable, Equatable, Sendable {
    let op: String
    var ref: String? = nil
    var category: String? = nil
    var subject: String? = nil
    var statement: String? = nil
    var reason: String? = nil
    let evidence: [String]
}

struct UserFactsResponse: Decodable, Equatable, Sendable {
    let ops: [UserFactOperation]
    let model: String
}

/// The one AI call the reconciler needs. Narrow so tests stub one method.
/// `ProxyAIService` conforms.
protocol UserFactExtracting: AnyObject {
    func extractUserFacts(_ request: UserFactsRequest) async throws -> UserFactsResponse
}
