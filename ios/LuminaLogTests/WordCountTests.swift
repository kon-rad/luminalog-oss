import XCTest
@testable import LuminaLog

final class WordCountTests: XCTestCase {
    func testEmptyIsZero() {
        XCTAssertEqual(WordCount.of(""), 0)
        XCTAssertEqual(WordCount.of("   \n  "), 0)
    }

    func testCountsWhitespaceSeparatedTokens() {
        XCTAssertEqual(WordCount.of("hello world"), 2)
        XCTAssertEqual(WordCount.of("  multiple   spaces\tand\nnewlines here "), 5)
    }
}
