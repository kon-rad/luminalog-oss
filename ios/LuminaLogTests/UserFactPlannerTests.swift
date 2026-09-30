import XCTest
@testable import LuminaLog

final class UserFactPlannerTests: XCTestCase {

    private typealias F = UserFactFixtures
    private let utc = TimeZone(identifier: "UTC")!
    private let now = UserFactFixtures.date("2026-09-28T12:00:00Z")

    func testUnsettledProcessingTranscribingAndEmptyEntriesWait() {
        let entries = [
            F.entry("fresh", "2026-09-28T11:50:00Z"),
            F.entry("uploading", "2026-09-20T10:00:00Z", processing: .uploading),
            F.entry("transcribing", "2026-09-20T10:00:00Z", transcript: .processing),
            F.entry("empty", "2026-09-20T10:00:00Z", content: "   "),
            F.entry("ready", "2026-09-20T10:00:00Z", processing: .ready),
        ]
        XCTAssertEqual(UserFactPlanner.pending(entries: entries, state: .init(), now: now).map(\.id), ["ready"])
    }

    func testPendingIsChronologicalAndSkipsWhatWasRead() {
        let e1 = F.entry("e1", "2026-09-10T10:00:00Z")
        let e2 = F.entry("e2", "2026-09-20T10:00:00Z")
        let e3 = F.entry("e3", "2026-09-05T10:00:00Z")
        let state = UserFactExtractionState(processed: ["e3": UserFactPlanner.stamp(e3)])
        XCTAssertEqual(UserFactPlanner.pending(entries: [e2, e3, e1], state: state, now: now).map(\.id), ["e1", "e2"])
    }

    func testAnEditedEntryIsReadAgain() {
        let original = F.entry("e1", "2026-09-10T10:00:00Z")
        let edited = F.entry("e1", "2026-09-10T10:00:00Z", edited: "2026-09-12T10:00:00Z")
        let state = UserFactExtractionState(processed: ["e1": UserFactPlanner.stamp(original)])
        XCTAssertEqual(UserFactPlanner.pending(entries: [edited], state: state, now: now).map(\.id), ["e1"])
    }

    func testASkippedEntryStaysSkippedUntilEdited() {
        let e1 = F.entry("e1", "2026-09-10T10:00:00Z")
        let state = UserFactExtractionState(skipped: ["e1": UserFactPlanner.stamp(e1)])
        XCTAssertTrue(UserFactPlanner.pending(entries: [e1], state: state, now: now).isEmpty)
        let edited = F.entry("e1", "2026-09-10T10:00:00Z", edited: "2026-09-12T10:00:00Z")
        XCTAssertEqual(UserFactPlanner.pending(entries: [edited], state: state, now: now).map(\.id), ["e1"])
    }

    func testNoPendingEntriesMeansNoBatch() {
        XCTAssertNil(UserFactPlanner.nextBatch(entries: [], facts: [], state: .init(), now: now, timeZone: utc))
    }

    func testBatchCapsAtEightEntries() throws {
        let entries = (10...19).map { F.entry("e\($0)", "2026-09-\($0)T10:00:00Z") }
        let batch = try XCTUnwrap(UserFactPlanner.nextBatch(entries: entries, facts: [], state: .init(), now: now, timeZone: utc))
        XCTAssertEqual(batch.entryIds, (10...17).map { "e\($0)" })
        XCTAssertEqual(Set(batch.stamps.keys), Set(batch.entryIds))
    }

    func testBatchCapsByCharactersAndTruncatesText() throws {
        let long = String(repeating: "x", count: 5_000)
        let entries = (10...16).map { F.entry("e\($0)", "2026-09-\($0)T10:00:00Z", content: long) }
        let batch = try XCTUnwrap(UserFactPlanner.nextBatch(entries: entries, facts: [], state: .init(), now: now, timeZone: utc))
        // 3,000 chars each after truncation; a sixth would pass the 16,000 cap.
        XCTAssertEqual(batch.entryIds.count, 5)
        XCTAssertEqual(batch.request.entries[0].text.count, UserFactPlanner.entryMaxChars)
    }

    func testAnEntryThatFailedTwiceGoesAlone() throws {
        let entries = [F.entry("e1", "2026-09-10T10:00:00Z"), F.entry("e2", "2026-09-11T10:00:00Z"), F.entry("e3", "2026-09-12T10:00:00Z")]
        let first = try XCTUnwrap(UserFactPlanner.nextBatch(entries: entries, facts: [], state: .init(failures: ["e1": 2]), now: now, timeZone: utc))
        XCTAssertEqual(first.entryIds, ["e1"])
        let second = try XCTUnwrap(UserFactPlanner.nextBatch(entries: entries, facts: [], state: .init(failures: ["e2": 2]), now: now, timeZone: utc))
        XCTAssertEqual(second.entryIds, ["e1"], "the batch stops before an entry that must go alone")
    }

    func testKnownFactsPutTheUsersFirstThenMostRecentlyConfirmed() throws {
        let facts = [
            F.fact("a", lastConfirmed: "2026-09-01T10:00:00Z"),
            F.fact("b", userAuthored: true, lastConfirmed: "2026-01-01T10:00:00Z"),
            F.fact("c", lastConfirmed: "2026-09-20T10:00:00Z"),
            F.fact("d", status: .invalidated),
            F.fact("r", statement: "Tom is your cousin.", status: .rejected),
        ]
        let batch = try XCTUnwrap(UserFactPlanner.nextBatch(
            entries: [F.entry("e1", "2026-09-10T10:00:00Z")], facts: facts, state: .init(), now: now, timeZone: utc))
        XCTAssertEqual(batch.request.facts.map(\.ref), ["f1", "f2", "f3"])
        XCTAssertEqual(batch.refs, ["f1": "b", "f2": "c", "f3": "a"])
        XCTAssertEqual(batch.request.facts[0].userAuthored, true)
        XCTAssertEqual(batch.request.facts[1].since, "2026-03-02")
        XCTAssertEqual(batch.request.rejected, [RejectedFactInput(category: "person", statement: "Tom is your cousin.")])
    }

    func testDateLabelUsesTheGivenTimeZoneAndDatesAreInstants() throws {
        let entry = F.entry("e1", "2026-09-20T20:00:00Z")
        let kl = TimeZone(identifier: "Asia/Kuala_Lumpur")!
        let batch = try XCTUnwrap(UserFactPlanner.nextBatch(entries: [entry], facts: [], state: .init(), now: now, timeZone: kl))
        XCTAssertEqual(batch.request.entries[0].date, "2026-09-21")
        XCTAssertEqual(batch.entryDates["e1"], entry.createdAt)
        XCTAssertEqual(batch.request.entries[0].title, "Title e1")
    }
}
