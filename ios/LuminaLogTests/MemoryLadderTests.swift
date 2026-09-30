import XCTest
@testable import LuminaLog

final class MemoryLadderTests: XCTestCase {

    private let utc = TimeZone(identifier: "UTC")!

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = utc
        return Int(floor(cal.date(from: DateComponents(year: y, month: m, day: d))!.timeIntervalSince1970 / 86_400))
    }

    private func doc(_ key: PeriodKey, isOpen: Bool, generatedOn day: Int) -> PeriodSummary {
        PeriodSummary(key: key, title: "Title \(key)", sentence: "Sentence \(key).", summary: "Summary \(key).",
                      generatedAt: Date(timeIntervalSince1970: TimeInterval(day) * 86_400 + 3_600),
                      sourceCount: 1, sourceFingerprint: "f", isOpen: isOpen, model: "m", promptVersion: 1)
    }

    func testRungsForSaturday26September2026() {
        let today = day(2026, 9, 26)
        XCTAssertEqual(MemoryLadder.rungs(today: today).map(\.key), [
            PeriodKey(.week, 202639),
            PeriodKey(.week, 202638),
            PeriodKey(.month, 2026 * 12 + 8),
            PeriodKey(.month, 2026 * 12 + 7),
            PeriodKey(.quarter, 2026 * 4 + 2),
            PeriodKey(.year, 2026),
            PeriodKey(.all, 0),
        ])
        XCTAssertEqual(MemoryLadder.rungs(today: today).map(\.title),
                       ["This week", "Last week", "This month", "Last month", "This quarter", "This year", "All time"])
    }

    func testLastMonthInJanuaryIsTheYearBeforesDecember() {
        let rungs = MemoryLadder.rungs(today: day(2027, 1, 10))
        XCTAssertEqual(rungs[3].key, PeriodKey(.month, 2026 * 12 + 11))
    }

    func testFormatsOpenClosedAndAllTimeRungs() {
        let today = day(2026, 9, 26)
        let rungs = MemoryLadder.rungs(today: today)
        let summaries = [
            doc(PeriodKey(.week, 202639), isOpen: true, generatedOn: day(2026, 9, 24)),
            doc(PeriodKey(.month, 2026 * 12 + 7), isOpen: false, generatedOn: day(2026, 9, 1)),
            doc(PeriodKey(.all, 0), isOpen: true, generatedOn: day(2026, 9, 24)),
        ]
        XCTAssertEqual(MemoryLadder.format(summaries, rungs: rungs, timeZone: utc), """
        This week so far (Week of Mon 21 Sep 2026, as of Thu 24 Sep 2026): Summary week_202639.
        Last month (August 2026): Sentence month_24319.
        All time (as of Thu 24 Sep 2026): Summary all_0.
        """)
    }

    func testFormatOmitsMissingRungsAndReturnsNilWhenEmpty() {
        let rungs = MemoryLadder.rungs(today: day(2026, 9, 26))
        XCTAssertNil(MemoryLadder.format([], rungs: rungs, timeZone: utc))
        let one = MemoryLadder.format([doc(PeriodKey(.year, 2026), isOpen: true, generatedOn: day(2026, 9, 20))],
                                      rungs: rungs, timeZone: utc)
        XCTAssertEqual(one, "This year so far (2026, as of Sun 20 Sep 2026): Sentence year_2026.")
    }

    func testAStillOpenLastWeekDocSaysAsOfButNotSoFar() {
        let rungs = MemoryLadder.rungs(today: day(2026, 9, 26))
        let text = MemoryLadder.format([doc(PeriodKey(.week, 202638), isOpen: true, generatedOn: day(2026, 9, 17))],
                                       rungs: rungs, timeZone: utc)
        XCTAssertEqual(text, "Last week (Week of Mon 14 Sep 2026, as of Thu 17 Sep 2026): Summary week_202638.")
    }

    @MainActor
    func testVoiceMemoryContextReadsCacheAndKicksAnOpenRefresh() async {
        let today = day(2026, 9, 26)
        let repo = InMemoryPeriodSummaryRepository([doc(PeriodKey(.week, 202639), isOpen: true, generatedOn: today)])
        let generator = LadderStubGenerator()
        let reconciler = PeriodSummaryReconciler(
            generator: generator, repository: repo,
            loadEntries: { ([], false) }, timeZone: { TimeZone(identifier: "UTC")! },
            hasConsent: { true }, isEnabled: { true },
            now: { Date(timeIntervalSince1970: TimeInterval(today) * 86_400 + 43_200) }
        )
        let context = await reconciler.voiceMemoryContext(timeZone: TimeZone(identifier: "UTC")!)
        XCTAssertEqual(context, "This week so far (Week of Mon 21 Sep 2026, as of Sat 26 Sep 2026): Summary week_202639.")
        let refresh = await reconciler.backgroundRefresh?.value
        XCTAssertNotNil(refresh)
        XCTAssertNil(refresh?.skipped)
    }

    @MainActor
    func testVoiceMemoryContextIsNilWhenDisabled() async {
        let reconciler = PeriodSummaryReconciler(
            generator: LadderStubGenerator(), repository: InMemoryPeriodSummaryRepository(),
            loadEntries: { ([], false) }, timeZone: { .current }, hasConsent: { true }, isEnabled: { false }
        )
        let context = await reconciler.voiceMemoryContext(timeZone: .current)
        XCTAssertNil(context)
        XCTAssertNil(reconciler.backgroundRefresh)
    }
}

@MainActor
private final class LadderStubGenerator: PeriodSummaryGenerating {
    func generatePeriodSummary(_ request: PeriodSummaryRequest) async throws -> GeneratedPeriodSummary {
        GeneratedPeriodSummary(title: "T", sentence: "S", summary: "B", salience: 5, anchors: [], keyScenes: .none, threads: [], model: "stub")
    }
}
