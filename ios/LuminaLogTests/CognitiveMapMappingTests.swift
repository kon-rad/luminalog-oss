import XCTest
import CryptoKit
@testable import LuminaLog

final class CognitiveMapMappingTests: XCTestCase {

    private let cipher = FieldCipher(key: SymmetricKey(size: .bits256))

    private func sampleMap() -> CognitiveMap {
        CognitiveMap(
            v: 1,
            beats: [
                Beat(id: "b0", tier: .map, kind: .event, text: "Only three signed up",
                     quote: "Only three signed up.", quoteStart: 0, domain: .craft,
                     isSpine: true, isKeeper: false, generality: 0.1, keepScore: 0.24,
                     degree: 1, mentions: [Mention(surface: "the beta", type: .project)]),
                Beat(id: "b1", tier: .ledger, kind: .feeling, text: "Scared",
                     quote: "I'm scared.", quoteStart: 22, domain: .mind,
                     isSpine: false, isKeeper: false, generality: 0.3, keepScore: 0.13,
                     degree: 1, mentions: []),
            ],
            edges: [MapEdge(from: "b0", to: "b1", type: .caused, phrasing: "drained", polarity: 1)]
        )
    }

    func testSealsAndOpensUnderTheCorrectContext() throws {
        let generation = CognitiveMapGeneration(
            map: sampleMap(), generatedAt: Date(timeIntervalSince1970: 1_755_000_000),
            model: "llama-3.3-70b", version: 1
        )
        let data = try generation.firestoreData(cipher: cipher)
        let reopened = try XCTUnwrap(CognitiveMapGeneration(data: data, cipher: cipher))

        XCTAssertEqual(reopened.map, generation.map)
        XCTAssertEqual(reopened.model, "llama-3.3-70b")
        XCTAssertEqual(reopened.version, 1)
        XCTAssertEqual(
            reopened.generatedAt.timeIntervalSince1970,
            generation.generatedAt.timeIntervalSince1970,
            accuracy: 1
        )
    }

    func testUsesTheSameAADStringAsTheWebClient() {
        // Must match web/src/lib/crypto/aad.ts `journalsCognitiveMapData` byte for
        // byte, or a map written on the phone cannot be opened in the browser.
        XCTAssertEqual(CognitiveMapGeneration.context, "journals.cognitiveMap.data")
    }

    func testStoresMetadataInPlaintextAndTheMapEncrypted() throws {
        let data = try CognitiveMapGeneration(map: sampleMap(), model: "m")
            .firestoreData(cipher: cipher)
        XCTAssertEqual(data["model"] as? String, "m")
        XCTAssertNotNil(data["generatedAt"])
        XCTAssertEqual(data["version"] as? Int, 1)
        // The map itself must NOT be readable: it is an envelope dict, not a string.
        XCTAssertNil(data["data"] as? String)
        XCTAssertNotNil(data["data"] as? [String: Any])
    }

    func testFailsClosedWhenDecryptedWithTheWrongKey() throws {
        let data = try CognitiveMapGeneration(map: sampleMap()).firestoreData(cipher: cipher)
        let otherCipher = FieldCipher(key: SymmetricKey(size: .bits256))
        XCTAssertNil(CognitiveMapGeneration(data: data, cipher: otherCipher))
    }

    func testReturnsNilForAMissingField() {
        XCTAssertNil(CognitiveMapGeneration(data: nil, cipher: cipher))
    }

    func testJournalEntryRoundTripsTheMap() throws {
        var entry = JournalEntry(
            userId: "u1", type: .text, title: "T",
            content: "Only three signed up. I'm scared."
        )
        entry.cognitiveMap = CognitiveMapGeneration(map: sampleMap(), model: "m")

        let data = try entry.firestoreData(cipher: cipher)
        let reopened = try XCTUnwrap(JournalEntry(documentId: entry.id, data: data, cipher: cipher))
        XCTAssertEqual(reopened.cognitiveMap?.map, sampleMap())
    }

    func testAnEntryWithoutAMapNeedsOne() {
        let entry = JournalEntry(userId: "u1", type: .text, title: "T", content: "Words here.")
        XCTAssertTrue(entry.needsCognitiveMap)
    }

    func testAnEntryWithAFreshMapDoesNotNeedOne() {
        var entry = JournalEntry(userId: "u1", type: .text, title: "T", content: "Words here.")
        entry.cognitiveMap = CognitiveMapGeneration(map: sampleMap(), generatedAt: Date())
        XCTAssertFalse(entry.needsCognitiveMap)
    }

    func testAMapOlderThanTheLastContentEditIsStale() {
        var entry = JournalEntry(userId: "u1", type: .text, title: "T", content: "Words here.")
        entry.cognitiveMap = CognitiveMapGeneration(
            map: sampleMap(), generatedAt: Date(timeIntervalSince1970: 1_000)
        )
        entry.contentEditedAt = Date(timeIntervalSince1970: 2_000)
        XCTAssertTrue(entry.needsCognitiveMap)
    }

    func testAMapFromAnOlderSchemaVersionIsStale() {
        var entry = JournalEntry(userId: "u1", type: .text, title: "T", content: "Words here.")
        entry.cognitiveMap = CognitiveMapGeneration(map: sampleMap(), version: 0)
        XCTAssertTrue(entry.needsCognitiveMap)
    }

    func testAnEmptyEntryNeverNeedsAMap() {
        let entry = JournalEntry(userId: "u1", type: .text, title: "T", content: "   ")
        XCTAssertFalse(entry.needsCognitiveMap)
    }
}
