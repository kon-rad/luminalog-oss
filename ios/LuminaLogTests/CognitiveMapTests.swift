import XCTest
@testable import LuminaLog

/// Decodes the SAME fixture the renderer package and the server test suite decode.
/// This is the contract drift guard: a field added in one language fails here until
/// Swift follows. See packages/cognitive-map/src/types.ts.
final class CognitiveMapTests: XCTestCase {

    private func fixtureData() throws -> Data {
        let url = try XCTUnwrap(
            Bundle(for: Self.self).url(forResource: "sample-map", withExtension: "json"),
            "sample-map.json is missing from the test bundle. Did project.yml get regenerated?"
        )
        return try Data(contentsOf: url)
    }

    private func fixture() throws -> CognitiveMap {
        try JSONDecoder().decode(CognitiveMap.self, from: fixtureData())
    }

    func testDecodesTheCanonicalFixture() throws {
        let map = try fixture()
        XCTAssertEqual(map.v, 1)
        XCTAssertEqual(map.beats.count, 6)
        XCTAssertEqual(map.edges.count, 4)
    }

    func testDecodesEveryBeatKind() throws {
        XCTAssertEqual(Set(try fixture().beats.map(\.kind)), [.event, .feeling, .belief, .intent])
    }

    func testDecodesTiersAndFlags() throws {
        let map = try fixture()
        let ledger = try XCTUnwrap(map.beats.first { $0.id == "b5" })
        XCTAssertEqual(ledger.tier, .ledger)
        let keeper = try XCTUnwrap(map.beats.first { $0.id == "b2" })
        XCTAssertTrue(keeper.isKeeper)
        XCTAssertFalse(keeper.isSpine)
    }

    func testDecodesMentions() throws {
        let beat = try XCTUnwrap(try fixture().beats.first { $0.id == "b0" })
        XCTAssertEqual(beat.mentions.map(\.surface), ["the beta"])
        XCTAssertEqual(beat.mentions.first?.type, .project)
    }

    func testDecodesEveryPolarity() throws {
        XCTAssertEqual(Set(try fixture().edges.map(\.polarity)), [1, -1, 0])
    }

    func testDecodesTheSnakeCasedEdgeType() throws {
        let edge = try XCTUnwrap(try fixture().edges.first { $0.from == "b1" && $0.to == "b2" })
        XCTAssertEqual(edge.type, .evidenceFor)
    }

    func testRoundTripsThroughEncodeAndDecode() throws {
        let original = try fixture()
        let decoded = try JSONDecoder().decode(
            CognitiveMap.self, from: try JSONEncoder().encode(original)
        )
        XCTAssertEqual(original, decoded)
    }

    func testDrawnBeatsExcludesTheLedgerTier() throws {
        XCTAssertEqual(try fixture().drawnBeats.map(\.id), ["b0", "b1", "b2", "b3", "b4"])
    }

    func testBeatLookupByID() throws {
        XCTAssertEqual(try fixture().beat(id: "b2")?.kind, .belief)
        XCTAssertNil(try fixture().beat(id: "nope"))
    }

    func testUnknownEnumValueFailsClosedRatherThanCrashing() throws {
        let bad = #"{"v":1,"beats":[{"id":"b0","tier":"map","kind":"wish","text":"x","quote":"x","quoteStart":0,"domain":"craft","isSpine":false,"isKeeper":false,"generality":0,"keepScore":0,"degree":0,"mentions":[]}],"edges":[]}"#
        XCTAssertThrowsError(try JSONDecoder().decode(CognitiveMap.self, from: Data(bad.utf8)))
    }
}
