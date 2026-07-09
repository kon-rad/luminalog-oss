import XCTest
@testable import LuminaLog

final class EntryRetrieverTests: XCTestCase {

    private let retriever = EntryRetriever()

    /// Fixed reference "now" so recency scoring is deterministic.
    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    /// Build a minimal plaintext entry. `daysAgo` sets `createdAt` relative to `now`.
    private func entry(
        id: String,
        title: String = "",
        content: String = "",
        daysAgo: Double = 0
    ) -> JournalEntry {
        JournalEntry(
            id: id,
            userId: "u1",
            type: .text,
            title: title,
            createdAt: now.addingTimeInterval(-daysAgo * 86_400),
            content: content
        )
    }

    private func ids(_ entries: [JournalEntry]) -> [String] { entries.map(\.id) }

    // MARK: - Keyword relevance

    func testEntryContainingQueryTermRanksAboveOneThatDoesnt() {
        let match = entry(id: "match", content: "I went hiking in the mountains today")
        let noMatch = entry(id: "nomatch", content: "A quiet afternoon reading books")
        let result = retriever.topK(2, matching: "hiking", in: [noMatch, match], now: now)
        XCTAssertEqual(ids(result).first, "match")
    }

    func testTitleMatchOutranksBodyOnlyMatch() {
        // Same term; one entry has it in the title, the other only in the body.
        // Give the body-only entry the recency edge to prove the title weight wins
        // on keyword score rather than on recency.
        let titleMatch = entry(id: "title", title: "Meditation practice", content: "nothing here", daysAgo: 10)
        let bodyMatch = entry(id: "body", title: "Random", content: "some meditation notes", daysAgo: 0)
        let result = retriever.topK(2, matching: "meditation", in: [bodyMatch, titleMatch], now: now)
        XCTAssertEqual(ids(result).first, "title")
    }

    func testMultiTermQueryEntryMatchingMoreDistinctTermsRanksHigher() {
        let two = entry(id: "two", content: "coffee and croissant for breakfast")
        let one = entry(id: "one", content: "coffee coffee coffee all morning")
        // "one" repeats a single term; "two" matches two distinct terms.
        let result = retriever.topK(2, matching: "coffee croissant", in: [one, two], now: now)
        XCTAssertEqual(ids(result).first, "two")
    }

    // MARK: - Recency

    func testRecencyBreaksKeywordTiesNewerFirst() {
        let older = entry(id: "older", content: "a walk in the park", daysAgo: 30)
        let newer = entry(id: "newer", content: "a walk in the park", daysAgo: 1)
        let result = retriever.topK(2, matching: "walk park", in: [older, newer], now: now)
        XCTAssertEqual(ids(result), ["newer", "older"])
    }

    func testRecencyNeverOverridesKeywordRelevance() {
        // Old but strongly-matching entry must still beat a brand-new non-matching one.
        let oldStrong = entry(id: "strong", title: "Gratitude", content: "gratitude gratitude", daysAgo: 365)
        let newWeak = entry(id: "weak", content: "unrelated musings", daysAgo: 0)
        let result = retriever.topK(2, matching: "gratitude", in: [newWeak, oldStrong], now: now)
        XCTAssertEqual(ids(result).first, "strong")
    }

    // MARK: - K bounds

    func testKGreaterThanCorpusReturnsAllRanked() {
        let a = entry(id: "a", content: "sunrise", daysAgo: 1)
        let b = entry(id: "b", content: "sunset", daysAgo: 2)
        let result = retriever.topK(10, matching: "sunrise", in: [a, b], now: now)
        XCTAssertEqual(result.count, 2)
        XCTAssertEqual(ids(result).first, "a")
    }

    func testKZeroOrNegativeReturnsEmpty() {
        let a = entry(id: "a", content: "anything")
        XCTAssertTrue(retriever.topK(0, matching: "anything", in: [a], now: now).isEmpty)
        XCTAssertTrue(retriever.topK(-5, matching: "anything", in: [a], now: now).isEmpty)
    }

    func testKLimitsCount() {
        let entries = (0..<5).map { entry(id: "e\($0)", content: "shared term extra\($0)", daysAgo: Double($0)) }
        let result = retriever.topK(3, matching: "shared", in: entries, now: now)
        XCTAssertEqual(result.count, 3)
    }

    func testEmptyCorpusReturnsEmpty() {
        XCTAssertTrue(retriever.topK(5, matching: "anything", in: [], now: now).isEmpty)
    }

    // MARK: - Empty / whitespace / punctuation queries

    func testEmptyQueryReturnsMostRecentK() {
        let a = entry(id: "a", content: "x", daysAgo: 5)
        let b = entry(id: "b", content: "x", daysAgo: 1)
        let c = entry(id: "c", content: "x", daysAgo: 10)
        let result = retriever.topK(2, matching: "", in: [a, b, c], now: now)
        XCTAssertEqual(ids(result), ["b", "a"]) // newest first, capped at K
    }

    func testWhitespaceOnlyQueryBehavesLikeEmpty() {
        let a = entry(id: "a", content: "x", daysAgo: 5)
        let b = entry(id: "b", content: "x", daysAgo: 1)
        let result = retriever.topK(2, matching: "   \n\t ", in: [a, b], now: now)
        XCTAssertEqual(ids(result), ["b", "a"])
    }

    func testPunctuationOnlyQueryBehavesLikeEmpty() {
        let a = entry(id: "a", content: "x", daysAgo: 5)
        let b = entry(id: "b", content: "x", daysAgo: 1)
        let result = retriever.topK(2, matching: "!!! ??? --- ...", in: [a, b], now: now)
        XCTAssertEqual(ids(result), ["b", "a"])
    }

    // MARK: - Unicode / case / diacritic folding

    func testDiacriticInsensitiveMatching() {
        let match = entry(id: "cafe", content: "met a friend at the cafe downtown")
        let noMatch = entry(id: "none", content: "stayed home all day")
        let result = retriever.topK(2, matching: "café", in: [noMatch, match], now: now)
        XCTAssertEqual(ids(result).first, "cafe")
    }

    func testCaseInsensitiveMatching() {
        let match = entry(id: "j", content: "wrote in my journal before bed")
        let noMatch = entry(id: "n", content: "went for a run")
        let result = retriever.topK(2, matching: "JOURNAL", in: [noMatch, match], now: now)
        XCTAssertEqual(ids(result).first, "j")
    }

    func testDiacriticFoldingIsSymmetric() {
        // Query without accent must match content that has the accent.
        let match = entry(id: "resume", content: "updated my résumé this weekend")
        let noMatch = entry(id: "none", content: "watched a movie")
        let result = retriever.topK(2, matching: "resume", in: [noMatch, match], now: now)
        XCTAssertEqual(ids(result).first, "resume")
    }
}
