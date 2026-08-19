import XCTest
@testable import LuminaLog

final class BeatInspectorTests: XCTestCase {

    private func beat(quote: String, quoteStart: Int, domain: LifeDomain = .craft) -> Beat {
        Beat(id: "b0", tier: .map, kind: .event, text: "t", quote: quote,
             quoteStart: quoteStart, domain: domain, isSpine: false, isKeeper: false,
             generality: 0, keepScore: 0, degree: 0, mentions: [])
    }

    private let content = "Only three people signed up. I'm scared it isn't good."

    func testHighlightsTheQuoteAtItsRecordedOffset() throws {
        let quote = "I'm scared it isn't good."
        let range = try XCTUnwrap(BeatQuoteHighlighter.range(
            in: content, for: beat(quote: quote, quoteStart: content.utf16.count - quote.utf16.count)
        ))
        XCTAssertEqual(String(content[range]), quote)
    }

    func testFallsBackToSearchWhenTheOffsetIsWrong() throws {
        // A stale offset (the entry was edited) must not highlight the wrong words.
        // Searching by content is the safe recovery.
        let range = try XCTUnwrap(BeatQuoteHighlighter.range(
            in: content, for: beat(quote: "I'm scared it isn't good.", quoteStart: 999)
        ))
        XCTAssertEqual(String(content[range]), "I'm scared it isn't good.")
    }

    func testDoesNotHighlightTheWrongWordsWhenTheOffsetPointsElsewhere() throws {
        // Offset 0 is "Only three...", but the quote is the second sentence. The
        // validation must reject the offset and fall back rather than trusting it.
        let range = try XCTUnwrap(BeatQuoteHighlighter.range(
            in: content, for: beat(quote: "I'm scared it isn't good.", quoteStart: 0)
        ))
        XCTAssertEqual(String(content[range]), "I'm scared it isn't good.")
    }

    func testReturnsNilWhenTheQuoteIsNoLongerPresent() {
        XCTAssertNil(BeatQuoteHighlighter.range(
            in: content, for: beat(quote: "Something never written.", quoteStart: 0)
        ))
    }

    func testHandlesAnEmptyQuote() {
        XCTAssertNil(BeatQuoteHighlighter.range(in: content, for: beat(quote: "", quoteStart: 0)))
    }

    func testHandlesAnOffsetPastTheEndOfTheContent() {
        XCTAssertNil(BeatQuoteHighlighter.range(
            in: "short", for: beat(quote: "short but wrong", quoteStart: 400)
        ))
    }

    func testHandlesANegativeOffset() {
        XCTAssertNil(BeatQuoteHighlighter.range(
            in: content, for: beat(quote: "not present", quoteStart: -5)
        ))
    }

    func testBuildsAnAttributedStringWithTheQuoteEmphasised() throws {
        let attributed = BeatQuoteHighlighter.highlight(
            content: content, beat: beat(quote: "Only three people signed up.", quoteStart: 0)
        )
        XCTAssertEqual(String(attributed.characters), content)
        // Exactly one highlighted run, and it is the quote rather than the whole string.
        let highlighted = attributed.runs.filter { $0.backgroundColor != nil }
        XCTAssertEqual(highlighted.count, 1)
        let run = try XCTUnwrap(highlighted.first)
        XCTAssertEqual(String(attributed[run.range].characters), "Only three people signed up.")
    }

    func testLeavesTheTextUnmarkedWhenTheQuoteIsMissing() {
        let attributed = BeatQuoteHighlighter.highlight(
            content: content, beat: beat(quote: "Never written.", quoteStart: 0)
        )
        XCTAssertEqual(String(attributed.characters), content)
        XCTAssertTrue(attributed.runs.allSatisfy { $0.backgroundColor == nil })
    }
}
