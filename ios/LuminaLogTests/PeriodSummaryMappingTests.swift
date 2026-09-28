import XCTest
import CryptoKit
@testable import LuminaLog

final class PeriodSummaryMappingTests: XCTestCase {

    private let cipher = FieldCipher(key: SymmetricKey(size: .bits256))

    private func summary() -> PeriodSummary {
        PeriodSummary(
            key: PeriodKey(.week, 202639),
            title: "Designing Argo's memory",
            sentence: "You shipped the period summaries spec.",
            summary: "You spent the week designing memory for Argo.",
            generatedAt: Date(timeIntervalSince1970: 1_790_000_000),
            sourceCount: 5,
            sourceFingerprint: "abc123",
            isOpen: true,
            model: "gemini-3-5-flash-lite",
            promptVersion: 1,
            details: PeriodSummaryDetails(
                salience: 8,
                anchors: [PeriodSummaryAnchor(entryId: "e9", quote: "I pressed the button and just sat there.")],
                keyScenes: PeriodSummaryKeyScenes(high: "e9", low: nil, turning: nil),
                threads: ["Argo launch"]
            )
        )
    }

    func testRoundTripsThroughFirestoreData() throws {
        let original = summary()
        let data = try original.firestoreData(cipher: cipher)
        let decoded = try PeriodSummary(firestore: data, id: original.key.docId, cipher: cipher)
        XCTAssertEqual(decoded.key, original.key)
        XCTAssertEqual(decoded.title, original.title)
        XCTAssertEqual(decoded.sentence, original.sentence)
        XCTAssertEqual(decoded.summary, original.summary)
        XCTAssertEqual(decoded.generatedAt.timeIntervalSince1970, original.generatedAt.timeIntervalSince1970, accuracy: 0.001)
        XCTAssertEqual(decoded.sourceCount, 5)
        XCTAssertEqual(decoded.sourceFingerprint, "abc123")
        XCTAssertTrue(decoded.isOpen)
        XCTAssertEqual(decoded.model, original.model)
        XCTAssertEqual(decoded.promptVersion, 1)
        XCTAssertEqual(decoded.details, original.details)
    }

    func testWritesPlaintextMetadataForTheTier() throws {
        let data = try summary().firestoreData(cipher: cipher)
        XCTAssertEqual(data["periodType"] as? String, "week")
        XCTAssertEqual(data["periodIndex"] as? Int, 202639)
    }

    func testTextIsNotStoredInPlaintext() throws {
        let data = try summary().firestoreData(cipher: cipher)
        let dump = String(describing: data)
        XCTAssertFalse(dump.contains("Designing Argo"))
        XCTAssertFalse(dump.contains("shipped the period summaries"))
        XCTAssertFalse(dump.contains("designing memory"))
        XCTAssertFalse(dump.contains("just sat there"))
        XCTAssertFalse(dump.contains("Argo launch"))
        XCTAssertNil(data["salience"], "salience lives inside the sealed details, not as metadata")
    }

    func testFieldsAreBoundToTheirOwnContext() throws {
        var data = try summary().firestoreData(cipher: cipher)
        // Swap the envelopes: AAD binding must make both fail to open.
        let sentence = data["sentence"]
        data["sentence"] = data["summary"]
        data["summary"] = sentence
        XCTAssertThrowsError(try PeriodSummary(firestore: data, id: "week_202639", cipher: cipher))
    }

    func testTitleIsBoundToItsOwnContext() throws {
        var data = try summary().firestoreData(cipher: cipher)
        data["title"] = data["sentence"]
        XCTAssertThrowsError(try PeriodSummary(firestore: data, id: "week_202639", cipher: cipher))
    }

    func testDetailsAreBoundToTheirOwnContext() throws {
        var data = try summary().firestoreData(cipher: cipher)
        data["details"] = data["summary"]
        XCTAssertThrowsError(try PeriodSummary(firestore: data, id: "week_202639", cipher: cipher))
    }

    func testMissingDetailsDecodeAsEmpty() throws {
        var data = try summary().firestoreData(cipher: cipher)
        data["details"] = nil
        let decoded = try PeriodSummary(firestore: data, id: "week_202639", cipher: cipher)
        XCTAssertEqual(decoded.details, .empty)
    }

    func testGeneratedSummaryDecodesTheServerReply() throws {
        let json = #"{"title":"T","sentence":"S.","summary":"B.","salience":7,"anchors":[{"entryId":"e1","quote":"Q"}],"keyScenes":{"high":"e1","low":null,"turning":null},"threads":["sleep"],"model":"m"}"#
        let generated = try JSONDecoder().decode(GeneratedPeriodSummary.self, from: Data(json.utf8))
        XCTAssertEqual(generated.details, PeriodSummaryDetails(
            salience: 7, anchors: [PeriodSummaryAnchor(entryId: "e1", quote: "Q")],
            keyScenes: PeriodSummaryKeyScenes(high: "e1", low: nil, turning: nil), threads: ["sleep"]))
    }

    func testRejectsAnUnparseableDocumentId() throws {
        let data = try summary().firestoreData(cipher: cipher)
        XCTAssertThrowsError(try PeriodSummary(firestore: data, id: "nonsense", cipher: cipher))
    }

    @MainActor
    func testInMemoryRepositoryReadsWritesAndDeletes() async throws {
        let repo = InMemoryPeriodSummaryRepository()
        try await repo.save(summary())
        let all = try await repo.all()
        XCTAssertEqual(all.map(\.key), [PeriodKey(.week, 202639)])
        let some = try await repo.summaries(for: [PeriodKey(.week, 202639), PeriodKey(.day, 1)])
        XCTAssertEqual(some.count, 1)
        try await repo.delete(PeriodKey(.week, 202639))
        let afterDelete = try await repo.all()
        XCTAssertTrue(afterDelete.isEmpty)
        XCTAssertEqual(repo.deleted, [PeriodKey(.week, 202639)])
    }
}
