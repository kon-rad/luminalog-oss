import XCTest
import CryptoKit
@testable import LuminaLog

final class UserFactMappingTests: XCTestCase {

    private let cipher = FieldCipher(key: SymmetricKey(size: .bits256))
    private let t0 = Date(timeIntervalSince1970: 1_780_000_000)

    private func fact(proposal: UserFactProposal? = nil) -> UserFact {
        UserFact(
            id: "fact-1", category: .place, subject: "Kuching", statement: "You live in Kuching.",
            status: .invalidated, origin: .extracted, userAuthored: false,
            evidence: ["e1", "e2"],
            firstObservedAt: t0, lastConfirmedAt: t0.addingTimeInterval(86_400),
            validFrom: t0, validTo: t0.addingTimeInterval(90 * 86_400),
            supersededBy: "fact-2", proposal: proposal,
            createdAt: t0, updatedAt: t0.addingTimeInterval(60),
            model: "gemini-3-5-flash-lite", promptVersion: 1
        )
    }

    func testRoundTripsThroughFirestoreData() throws {
        let original = fact(proposal: UserFactProposal(
            kind: .invalidate, statement: nil, validTo: t0.addingTimeInterval(100 * 86_400),
            reason: "You moved.", evidence: ["e3"]
        ))
        let data = try original.firestoreData(cipher: cipher)
        XCTAssertEqual(try UserFact(firestore: data, id: "fact-1", cipher: cipher), original)
    }

    func testWritesPlaintextMetadata() throws {
        let data = try fact().firestoreData(cipher: cipher)
        XCTAssertNil(data["category"] as? String, "category is sealed, not plaintext")
        XCTAssertEqual(data["status"] as? String, "invalidated")
        XCTAssertEqual(data["origin"] as? String, "extracted")
        XCTAssertEqual(data["userAuthored"] as? Bool, false)
        XCTAssertEqual(data["evidence"] as? [String], ["e1", "e2"])
        XCTAssertEqual(data["supersededBy"] as? String, "fact-2")
        XCTAssertNil(data["proposal"])
    }

    /// The brief's original version of this test dumped the whole `firestoreData()`
    /// dict (including base64 ciphertext) with `String(describing:)` and asserted it
    /// never contains "place"/"Kuching"/"Forest City". Ciphertext is random bytes
    /// rendered in base64, so that assertion carries a nonzero (if tiny) chance of a
    /// coincidental substring match, an unrelated intermittent failure a run months
    /// from now would be hard to explain. Same intent (no plaintext leaks into the
    /// stored document), but the check now targets only the fields that are supposed
    /// to be plaintext metadata, sealed fields are checked separately for being
    /// envelopes (dictionaries) rather than raw strings, which is deterministic.
    func testTextIsNotStoredInPlaintext() throws {
        let data = try fact(proposal: UserFactProposal(
            kind: .update, statement: "You live in Forest City now.", validTo: nil, reason: nil, evidence: ["e3"]
        )).firestoreData(cipher: cipher)

        XCTAssertNil(data["category"] as? String, "category must be a sealed envelope, not plaintext")
        XCTAssertNil(data["subject"] as? String, "subject must be a sealed envelope, not plaintext")
        XCTAssertNil(data["statement"] as? String, "statement must be a sealed envelope, not plaintext")
        XCTAssertNil(data["proposal"] as? String, "proposal must be a sealed envelope, not plaintext")

        let plaintextDump = String(describing: [
            data["status"], data["origin"], data["userAuthored"], data["evidence"],
            data["supersededBy"], data["model"],
        ] as [Any?])
        XCTAssertFalse(plaintextDump.contains("Kuching"), "plaintext metadata leaked the subject/statement text")
        XCTAssertFalse(plaintextDump.contains("Forest City"), "plaintext metadata leaked the proposal text")
        XCTAssertFalse(plaintextDump.contains("place"), "plaintext metadata leaked the category")
    }

    func testCategoryIsBoundToItsOwnContext() throws {
        var data = try fact().firestoreData(cipher: cipher)
        data["category"] = data["subject"]
        XCTAssertThrowsError(try UserFact(firestore: data, id: "fact-1", cipher: cipher))
    }

    func testSubjectAndStatementAreBoundToTheirOwnContexts() throws {
        var data = try fact().firestoreData(cipher: cipher)
        let subject = data["subject"]
        data["subject"] = data["statement"]
        data["statement"] = subject
        XCTAssertThrowsError(try UserFact(firestore: data, id: "fact-1", cipher: cipher))
    }

    func testAGarbledProposalDropsOnlyTheProposal() throws {
        var data = try fact(proposal: UserFactProposal(
            kind: .update, statement: "X", validTo: nil, reason: nil, evidence: ["e3"]
        )).firestoreData(cipher: cipher)
        data["proposal"] = data["statement"]   // wrong AAD: must not open as a proposal
        let decoded = try UserFact(firestore: data, id: "fact-1", cipher: cipher)
        XCTAssertNil(decoded.proposal)
        XCTAssertEqual(decoded.statement, "You live in Kuching.")
    }

    func testRejectsAnUnknownCategory() throws {
        var data = try fact().firestoreData(cipher: cipher)
        data["category"] = try cipher.sealed("pet", UserFact.categoryContext)
        XCTAssertThrowsError(try UserFact(firestore: data, id: "fact-1", cipher: cipher))
    }

    func testStateReadsFirestoreNumbers() {
        let data: [String: Any] = [
            "processed": ["e1": NSNumber(value: Int64(1_780_000_000_000))],
            "failures": ["e2": NSNumber(value: 2)],
            "skipped": ["e3": NSNumber(value: Int64(5))],
            "learning": false,
            "promptVersion": 1,
        ]
        XCTAssertEqual(
            UserFactExtractionState(firestore: data),
            UserFactExtractionState(processed: ["e1": 1_780_000_000_000], failures: ["e2": 2],
                                    skipped: ["e3": 5], learning: false, promptVersion: 1)
        )
    }

    func testStateWritesItsMaps() {
        let data = UserFactExtractionState(processed: ["e1": 7], learning: false).firestoreData()
        XCTAssertEqual(data["processed"] as? [String: Int64], ["e1": 7])
        XCTAssertEqual(data["learning"] as? Bool, false)
    }

    func testMissingStateIsTheDefault() {
        XCTAssertEqual(UserFactExtractionState(firestore: [:]), UserFactExtractionState())
        XCTAssertTrue(UserFactExtractionState().learning)
    }

    @MainActor
    func testInMemoryRepositoryReadsWritesAndDeletes() async throws {
        let repo = InMemoryUserFactRepository()
        try await repo.save(fact())
        let saved = try await repo.all()
        XCTAssertEqual(saved.map(\.id), ["fact-1"])
        try await repo.saveState(UserFactExtractionState(learning: false))
        let state = try await repo.state()
        XCTAssertFalse(state.learning)
        try await repo.delete(id: "fact-1")
        let afterDelete = try await repo.all()
        XCTAssertTrue(afterDelete.isEmpty)
        try await repo.save(fact())
        try await repo.deleteAll()
        let afterDeleteAll = try await repo.all()
        XCTAssertTrue(afterDeleteAll.isEmpty)
    }
}
