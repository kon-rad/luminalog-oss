import XCTest
@testable import LuminaLog

final class StoryMapShownEntriesTests: XCTestCase {

    private func beat(_ id: String, _ text: String) -> Beat {
        Beat(id: id, tier: .map, kind: .event, text: text, quote: text, quoteStart: 0,
             domain: .craft, isSpine: false, isKeeper: false, generality: 0,
             keepScore: 0, degree: 0, mentions: [])
    }

    private func map(_ beats: Beat...) -> CognitiveMap {
        CognitiveMap(v: 1, beats: beats, edges: [])
    }

    /// A -> B -> A: the renderer shows A from its cache without asking again, so a tap
    /// on A's "b0" must resolve against A's map even though B's was pushed last.
    func testBeatTapResolvesAgainstTheDayItCameFromNotTheLastPush() {
        var shown = StoryMapShownEntries()
        shown.record(day: 100, map: map(beat("b0", "Day A")), content: "Entry A")
        shown.record(day: 101, map: map(beat("b0", "Day B")), content: "Entry B")

        let found = shown.beat(id: "b0", day: 100)
        XCTAssertEqual(found?.beat.text, "Day A")
        XCTAssertEqual(found?.content, "Entry A")
        XCTAssertEqual(shown.beat(id: "b0", day: 101)?.content, "Entry B")
    }

    func testAChipSwitchReplacesThatDaysMap() {
        var shown = StoryMapShownEntries()
        shown.record(day: 100, map: map(beat("b0", "First")), content: "First entry")
        shown.record(day: 100, map: map(beat("b0", "Second")), content: "Second entry")
        XCTAssertEqual(shown.beat(id: "b0", day: 100)?.beat.text, "Second")
        XCTAssertEqual(shown.beat(id: "b0", day: 100)?.content, "Second entry")
    }

    func testUnknownDayOrBeatResolvesToNil() {
        var shown = StoryMapShownEntries()
        shown.record(day: 100, map: map(beat("b0", "A")), content: "A")
        XCTAssertNil(shown.beat(id: "b0", day: 999))
        XCTAssertNil(shown.beat(id: "b9", day: 100))
    }

    func testDecodesTheRenderersSelectBeatPayload() {
        XCTAssertEqual(
            StoryMapShownEntries.decodeSelectBeat(#"{"beatId":"b2","day":20721}"#),
            StoryMapShownEntries.SelectBeatPayload(beatId: "b2", day: 20721)
        )
        // The old bare-id message (a stale bundle) is rejected rather than guessed at.
        XCTAssertNil(StoryMapShownEntries.decodeSelectBeat("b2"))
        XCTAssertNil(StoryMapShownEntries.decodeSelectBeat(42))
    }
}
