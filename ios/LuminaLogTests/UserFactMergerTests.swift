import XCTest
@testable import LuminaLog

final class UserFactMergerTests: XCTestCase {

    private typealias F = UserFactFixtures
    private let now = UserFactFixtures.date("2026-09-28T12:00:00Z")

    private func batch(_ entries: [String: String], refs: [String: String] = [:]) -> UserFactPlanner.Batch {
        UserFactPlanner.Batch(
            request: UserFactsRequest(entries: [], facts: [], rejected: []),
            stamps: [:], refs: refs, entryDates: entries.mapValues(F.date)
        )
    }

    private func apply(_ ops: [UserFactOperation], to facts: [UserFact], _ batch: UserFactPlanner.Batch) -> UserFactMerger.Outcome {
        var n = 0
        return UserFactMerger.apply(ops, to: facts, batch: batch, model: "m2", now: now, makeId: { n += 1; return "new-\(n)" })
    }

    private let sep21 = "2026-09-21T10:00:00Z"
    private let sep25 = "2026-09-25T10:00:00Z"

    func testAddCreatesAFactDatedByItsEvidence() throws {
        let outcome = apply([UserFactOperation(op: "add", category: "place", subject: "Forest City",
                                               statement: "You live in Forest City.", evidence: ["e2", "e1"])],
                            to: [], batch(["e1": sep21, "e2": sep25]))
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(outcome.added, 1)
        XCTAssertEqual(fact.id, "new-1")
        XCTAssertEqual(fact.category, .place)
        XCTAssertEqual(fact.validFrom, F.date(sep21))
        XCTAssertEqual(fact.firstObservedAt, F.date(sep21))
        XCTAssertEqual(fact.lastConfirmedAt, F.date(sep25))
        XCTAssertEqual(fact.origin, .extracted)
        XCTAssertFalse(fact.userAuthored)
        XCTAssertEqual(fact.model, "m2")
    }

    func testAddMatchingATombstoneIsDropped() {
        let tomb = F.fact("t", statement: "Tom is your cousin.", status: .rejected)
        let outcome = apply([UserFactOperation(op: "add", category: "person", subject: "Tom",
                                               statement: "  tom is your COUSIN ", evidence: ["e1"])],
                            to: [tomb], batch(["e1": sep21]))
        XCTAssertEqual(outcome.dropped, 1)
        XCTAssertTrue(outcome.upserts.isEmpty)
    }

    func testAddMatchingAnActiveFactBecomesAConfirm() throws {
        let known = F.fact("k", category: .place, subject: "Kuching", statement: "You live in Kuching.")
        let outcome = apply([UserFactOperation(op: "add", category: "place", subject: "Kuching",
                                               statement: "You live in Kuching", evidence: ["e1"])],
                            to: [known], batch(["e1": sep21]))
        XCTAssertEqual(outcome.added, 0)
        XCTAssertEqual(outcome.confirmed, 1)
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(fact.id, "k")
        XCTAssertEqual(fact.evidence, ["e0", "e1"])
        XCTAssertEqual(fact.lastConfirmedAt, F.date(sep21))
    }

    func testConfirmOnAUserAuthoredFactOnlyTouchesMetadata() throws {
        let mine = F.fact("k", statement: "Maya is my sister.", userAuthored: true)
        let outcome = apply([UserFactOperation(op: "confirm", ref: "f1", evidence: ["e1"])],
                            to: [mine], batch(["e1": sep21], refs: ["f1": "k"]))
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(fact.statement, "Maya is my sister.")
        XCTAssertEqual(fact.evidence, ["e0", "e1"])
        XCTAssertEqual(fact.lastConfirmedAt, F.date(sep21))
        XCTAssertNil(fact.proposal)
    }

    func testUpdateRewritesAnExtractedFact() throws {
        let known = F.fact("k", statement: "Maya is your sister.")
        let outcome = apply([UserFactOperation(op: "update", ref: "f1", statement: "Maya is your younger sister in Warsaw.", evidence: ["e1"])],
                            to: [known], batch(["e1": sep21], refs: ["f1": "k"]))
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(outcome.updated, 1)
        XCTAssertEqual(fact.statement, "Maya is your younger sister in Warsaw.")
        XCTAssertEqual(fact.validFrom, known.validFrom, "an update is the same truth, so it keeps its start")
    }

    func testUpdateIntoATombstoneIsDropped() {
        let tomb = F.fact("t", statement: "Tom is your cousin.", status: .rejected)
        let known = F.fact("k", category: .person, subject: "Tom", statement: "Tom is your friend.")
        let outcome = apply([UserFactOperation(op: "update", ref: "f1", statement: "  tom is your COUSIN ", evidence: ["e1"])],
                            to: [tomb, known], batch(["e1": sep21], refs: ["f1": "k"]))
        XCTAssertEqual(outcome.dropped, 1)
        XCTAssertTrue(outcome.upserts.isEmpty)
    }

    func testUpdateIntoATombstoneOnAUserAuthoredFactIsDropped() {
        let tomb = F.fact("t", statement: "Tom is your cousin.", status: .rejected)
        let mine = F.fact("k", category: .person, subject: "Tom", statement: "Tom is my friend.", userAuthored: true)
        let outcome = apply([UserFactOperation(op: "update", ref: "f1", statement: "tom is your COUSIN", evidence: ["e1"])],
                            to: [tomb, mine], batch(["e1": sep21], refs: ["f1": "k"]))
        XCTAssertEqual(outcome.dropped, 1)
        XCTAssertTrue(outcome.upserts.isEmpty, "no proposal is created for an update into a tombstone")
    }

    func testUpdateWithTheSameStatementIsTreatedAsAConfirm() throws {
        let known = F.fact("k", statement: "Maya is your sister.")
        let outcome = apply([UserFactOperation(op: "update", ref: "f1", statement: "maya IS your sister", evidence: ["e1"])],
                            to: [known], batch(["e1": sep21], refs: ["f1": "k"]))
        XCTAssertEqual(outcome.updated, 0)
        XCTAssertEqual(outcome.confirmed, 1)
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(fact.statement, "Maya is your sister.", "the original wording is kept, not the model's paraphrase")
        XCTAssertEqual(fact.evidence, ["e0", "e1"])
    }

    func testUpdateOnAUserAuthoredFactBecomesAProposal() throws {
        let mine = F.fact("k", statement: "Maya is my sister.", userAuthored: true)
        let outcome = apply([UserFactOperation(op: "update", ref: "f1", statement: "Maya is your younger sister.", evidence: ["e1"])],
                            to: [mine], batch(["e1": sep21], refs: ["f1": "k"]))
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(outcome.proposed, 1)
        XCTAssertEqual(fact.statement, "Maya is my sister.")
        XCTAssertEqual(fact.proposal, UserFactProposal(kind: .update, statement: "Maya is your younger sister.",
                                                       validTo: nil, reason: nil, evidence: ["e1"]))
    }

    func testInvalidateEndsAnExtractedFactOnTheEntryDate() throws {
        let known = F.fact("k", category: .place, subject: "Kuching", statement: "You live in Kuching.")
        let outcome = apply([UserFactOperation(op: "invalidate", ref: "f1", reason: "You moved.", evidence: ["e2", "e1"])],
                            to: [known], batch(["e1": sep21, "e2": sep25], refs: ["f1": "k"]))
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(outcome.invalidated, 1)
        XCTAssertEqual(fact.status, .invalidated)
        XCTAssertEqual(fact.validTo, F.date(sep21), "the end date is the earliest cited entry, never a model date")
        XCTAssertEqual(fact.validFrom, known.validFrom)
    }

    func testInvalidateOnAUserAuthoredFactBecomesAProposal() throws {
        let mine = F.fact("k", category: .place, statement: "I live in Kuching.", userAuthored: true)
        let outcome = apply([UserFactOperation(op: "invalidate", ref: "f1", reason: "You moved.", evidence: ["e1"])],
                            to: [mine], batch(["e1": sep21], refs: ["f1": "k"]))
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(fact.status, .active)
        XCTAssertEqual(fact.proposal, UserFactProposal(kind: .invalidate, statement: nil, validTo: F.date(sep21),
                                                       reason: "You moved.", evidence: ["e1"]))
    }

    func testInvalidateWithEvidenceOlderThanTheFactIsDropped() {
        let known = F.fact("k", validFrom: "2026-03-02T10:00:00Z")
        let outcome = apply([UserFactOperation(op: "invalidate", ref: "f1", reason: "x", evidence: ["old"])],
                            to: [known], batch(["old": "2026-02-01T10:00:00Z"], refs: ["f1": "k"]))
        XCTAssertEqual(outcome.dropped, 1)
        XCTAssertTrue(outcome.upserts.isEmpty)
    }

    func testStaleInvalidateOnAUserAuthoredFactIsDropped() {
        let mine = F.fact("k", userAuthored: true, validFrom: "2026-03-02T10:00:00Z")
        let outcome = apply([UserFactOperation(op: "invalidate", ref: "f1", reason: "x", evidence: ["old"])],
                            to: [mine], batch(["old": "2026-02-01T10:00:00Z"], refs: ["f1": "k"]))
        XCTAssertEqual(outcome.dropped, 1)
        XCTAssertTrue(outcome.upserts.isEmpty, "no proposal is created for a stale invalidate either")
    }

    func testTheReplacementIsLinkedBySupersededBy() throws {
        let known = F.fact("k", category: .place, subject: "Kuching", statement: "You live in Kuching.")
        let outcome = apply([
            UserFactOperation(op: "invalidate", ref: "f1", reason: "You moved.", evidence: ["e1"]),
            UserFactOperation(op: "add", category: "place", subject: "Forest City", statement: "You live in Forest City.", evidence: ["e1"]),
        ], to: [known], batch(["e1": sep21], refs: ["f1": "k"]))
        let old = try XCTUnwrap(outcome.upserts.first { $0.id == "k" })
        XCTAssertEqual(old.supersededBy, "new-1", "the single add in the same category replaces it")
    }

    func testNoLinkWhenTheReplacementIsAmbiguous() throws {
        let known = F.fact("k", category: .place, subject: "Kuching", statement: "You live in Kuching.")
        let outcome = apply([
            UserFactOperation(op: "invalidate", ref: "f1", reason: "You moved.", evidence: ["e1"]),
            UserFactOperation(op: "add", category: "place", subject: "Forest City", statement: "You live in Forest City.", evidence: ["e1"]),
            UserFactOperation(op: "add", category: "place", subject: "JB", statement: "You work in Johor Bahru.", evidence: ["e1"]),
        ], to: [known], batch(["e1": sep21], refs: ["f1": "k"]))
        XCTAssertNil(try XCTUnwrap(outcome.upserts.first { $0.id == "k" }).supersededBy)
    }

    func testNoLinkForAPersonInvalidateWithAnUnrelatedPersonAdd() throws {
        let known = F.fact("k", category: .person, subject: "Maya", statement: "Maya is your sister.")
        let outcome = apply([
            UserFactOperation(op: "invalidate", ref: "f1", reason: "She moved away.", evidence: ["e1"]),
            UserFactOperation(op: "add", category: "person", subject: "Sam", statement: "Sam is your friend.", evidence: ["e1"]),
        ], to: [known], batch(["e1": sep21], refs: ["f1": "k"]))
        XCTAssertNil(try XCTUnwrap(outcome.upserts.first { $0.id == "k" }).supersededBy,
                     "person is not single-valued, so a single unrelated add must not link")
    }

    func testOpsOnAFactThatIsNoLongerActiveAreDropped() {
        let deleted = F.fact("k", status: .rejected)
        let outcome = apply([UserFactOperation(op: "confirm", ref: "f1", evidence: ["e1"])],
                            to: [deleted], batch(["e1": sep21], refs: ["f1": "k"]))
        XCTAssertEqual(outcome.dropped, 1)
        XCTAssertTrue(outcome.upserts.isEmpty)
    }

    func testEvidenceOutsideTheBatchAndUnknownKindsAreDropped() {
        let known = F.fact("k")
        let outcome = apply([
            UserFactOperation(op: "confirm", ref: "f1", evidence: ["not-in-batch"]),
            UserFactOperation(op: "merge", ref: "f1", evidence: ["e1"]),
        ], to: [known], batch(["e1": sep21], refs: ["f1": "k"]))
        XCTAssertEqual(outcome.dropped, 2)
    }

    func testEvidenceKeepsTheNewestTwenty() throws {
        let crowded = F.fact("k", evidence: (1...20).map { "old\($0)" })
        let outcome = apply([UserFactOperation(op: "confirm", ref: "f1", evidence: ["e1"])],
                            to: [crowded], batch(["e1": sep21], refs: ["f1": "k"]))
        let fact = try XCTUnwrap(outcome.upserts.first)
        XCTAssertEqual(fact.evidence.count, UserFactMerger.maxEvidence)
        XCTAssertEqual(fact.evidence.first, "old2")
        XCTAssertEqual(fact.evidence.last, "e1")
    }

    func testPruneRemovesDeletedEvidenceAndDeletesUngroundedExtractedFacts() {
        let facts = [
            F.fact("keep", evidence: ["e1", "gone"]),
            F.fact("ungrounded", evidence: ["gone"]),
            F.fact("mine", userAuthored: true, evidence: ["gone"]),
            F.fact("tomb", status: .rejected, evidence: ["gone"]),
            F.fact("untouched", evidence: ["e1"]),
        ]
        let (updated, deleted) = UserFactMerger.pruneDeletedEntries(facts, liveEntryIds: ["e1"], now: now)
        XCTAssertEqual(deleted, ["ungrounded"])
        XCTAssertEqual(updated.map(\.id), ["keep", "mine", "tomb"])
        XCTAssertEqual(updated.first { $0.id == "keep" }?.evidence, ["e1"])
        XCTAssertEqual(updated.first { $0.id == "mine" }?.evidence, [])
    }
}
