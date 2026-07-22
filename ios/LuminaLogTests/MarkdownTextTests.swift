import XCTest
@testable import LuminaLog

final class MarkdownTextTests: XCTestCase {

    // MARK: - Headings

    func testParsesHeadingLevels() {
        XCTAssertEqual(markdownBlocks("# Title"), [.heading("Title", level: 1)])
        XCTAssertEqual(markdownBlocks("### Deep"), [.heading("Deep", level: 3)])
    }

    func testHeadingRequiresContent() {
        // A lone "#" with no text is not a heading.
        XCTAssertEqual(markdownBlocks("#"), [])
    }

    // MARK: - Bullets

    func testParsesDashAndStarBullets() {
        XCTAssertEqual(
            markdownBlocks("- first\n* second"),
            [.bullet("first"), .bullet("second")]
        )
    }

    // MARK: - Ordered lists

    func testParsesOrderedList() {
        XCTAssertEqual(
            markdownBlocks("1. first\n2. second"),
            [.ordered("first", number: 1), .ordered("second", number: 2)]
        )
    }

    func testParsesOrderedListWithParenMarker() {
        XCTAssertEqual(markdownBlocks("3) third"), [.ordered("third", number: 3)])
    }

    func testDigitsWithoutMarkerAreParagraph() {
        // "1 apple" (no dot) is prose, not an ordered item.
        XCTAssertEqual(markdownBlocks("1 apple"), [.paragraph("1 apple")])
    }

    func testOrderedItemRequiresContent() {
        XCTAssertEqual(markdownBlocks("1."), [.paragraph("1.")])
    }

    // MARK: - Paragraphs

    func testMergesConsecutiveLinesIntoOneParagraph() {
        XCTAssertEqual(
            markdownBlocks("line one\nline two"),
            [.paragraph("line one line two")]
        )
    }

    func testBlankLineSeparatesParagraphs() {
        XCTAssertEqual(
            markdownBlocks("first para\n\nsecond para"),
            [.paragraph("first para"), .paragraph("second para")]
        )
    }

    // MARK: - Mixed & edge cases

    func testMixedBlocks() {
        let input = """
        ## Summary

        You did well.
        - kept mornings
        1. keep going
        """
        XCTAssertEqual(
            markdownBlocks(input),
            [
                .heading("Summary", level: 2),
                .paragraph("You did well."),
                .bullet("kept mornings"),
                .ordered("keep going", number: 1)
            ]
        )
    }

    func testEmptyInputProducesNoBlocks() {
        XCTAssertEqual(markdownBlocks(""), [])
        XCTAssertEqual(markdownBlocks("\n\n   \n"), [])
    }

    // MARK: - Inline fallback

    func testInlineMarkdownParsesEmphasis() {
        let result = inlineMarkdown("**bold** text")
        XCTAssertEqual(String(result.characters), "bold text")
    }

    func testInlineMarkdownFallsBackToPlainText() {
        // Unbalanced markers should not crash; the raw text is preserved.
        let raw = "value = a ** b without close"
        let result = inlineMarkdown(raw)
        XCTAssertFalse(String(result.characters).isEmpty)
    }
}
