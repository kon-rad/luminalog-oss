import XCTest
@testable import LuminaLog

final class WordFrequencyAnalyzerTests: XCTestCase {

    func testLemmatizationCollapsesInflections() {
        let text = "I am running. I ran yesterday and I will run tomorrow."
        let words = WordFrequencyAnalyzer.topWords(in: text, limit: 10)
        let run = words.first { $0.word == "run" }
        XCTAssertNotNil(run, "running/ran/run should lemmatize to 'run'")
        XCTAssertGreaterThanOrEqual(run?.count ?? 0, 3)
        XCTAssertEqual(words.first?.word, "run", "'run' should be the top word")
    }

    func testStopWordsAndShortWordsRemoved() {
        let text = "I am the and to of a is run run run"
        let words = WordFrequencyAnalyzer.topWords(in: text, limit: 20)
        let found = Set(words.map(\.word))
        for stop in ["i", "am", "the", "and", "to", "of", "a", "is"] {
            XCTAssertFalse(found.contains(stop), "stop word '\(stop)' should be filtered")
        }
        XCTAssertTrue(found.contains("run"))
    }

    func testEmptyAndWhitespaceReturnEmpty() {
        XCTAssertTrue(WordFrequencyAnalyzer.topWords(in: "", limit: 10).isEmpty)
        XCTAssertTrue(WordFrequencyAnalyzer.topWords(in: "   \n  ", limit: 10).isEmpty)
    }

    func testAggregatesAcrossEntriesAndRespectsLimit() {
        let e1 = JournalEntry(userId: "u", type: .text, title: "", content: "garden garden flowers")
        let e2 = JournalEntry(userId: "u", type: .text, title: "", content: "garden flowers sunlight")
        let words = WordFrequencyAnalyzer.topWords(from: [e1, e2], limit: 2)
        XCTAssertEqual(words.count, 2)
        XCTAssertEqual(words.first?.word, "garden")
        XCTAssertEqual(words.first?.count, 3)
    }
}
