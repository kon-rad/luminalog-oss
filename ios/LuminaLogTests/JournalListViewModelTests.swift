import XCTest
@testable import LuminaLog

final class JournalListViewModelTests: XCTestCase {

    /// `JournalRepository` whose paged `entries` call fails until
    /// `pagesShouldFail` is cleared; streams stay silent (per protocol).
    @MainActor
    private final class FailingJournalRepository: JournalRepository {
        struct PageError: Error {}

        var pagesShouldFail = true
        var seed: [JournalEntry]

        init(seed: [JournalEntry] = MockData.journalEntries) {
            self.seed = seed
        }

        func recentEntries(limit: Int) -> AsyncStream<[JournalEntry]> {
            AsyncStream { _ in } // silent, like an erroring listener
        }

        func entries(after: Date?, limit: Int) async throws -> [JournalEntry] {
            if pagesShouldFail { throw PageError() }
            let sorted = seed.sorted { $0.createdAt > $1.createdAt }
            let filtered = after.map { date in sorted.filter { $0.createdAt < date } } ?? sorted
            return Array(filtered.prefix(limit))
        }

        func entry(id: String) -> AsyncStream<JournalEntry?> {
            AsyncStream { $0.finish() }
        }

        func save(_ entry: JournalEntry) async throws {}
        func updateAIFields(
            id: String,
            summary: AIGeneration?,
            insights: AIGeneration?,
            prompts: AIPrompts?
        ) async throws {}
        func updateContent(id: String, content: String, contentEditedAt: Date, appendedMedia: [MediaItem]) async throws {}
        func applyEntryEdit(id: String, title: String, content: String, contentEditedAt: Date?, edit: EditRecord) async throws {}
        func delete(id: String) async throws {}
    }

    @MainActor
    private func makeViewModel(
        entries: [JournalEntry] = MockData.journalEntries,
        pageSize: Int = 20
    ) -> JournalListViewModel {
        JournalListViewModel(
            journals: MockJournalRepository(entries: entries),
            pageSize: pageSize
        )
    }

    // MARK: - Type filter

    @MainActor
    func testTypeFilterShowsOnlyMatchingEntries() async {
        let viewModel = makeViewModel()
        await viewModel.start()

        XCTAssertEqual(viewModel.filter, .all)
        XCTAssertEqual(viewModel.displayedEntries.count, viewModel.entries.count)

        viewModel.filter = .type(.voice)
        XCTAssertFalse(viewModel.displayedEntries.isEmpty, "Seed data contains voice entries")
        XCTAssertTrue(viewModel.displayedEntries.allSatisfy { $0.type == .voice })

        let expectedVoiceCount = MockData.journalEntries.filter { $0.type == .voice }.count
        XCTAssertEqual(viewModel.displayedEntries.count, expectedVoiceCount)
    }

    // MARK: - Search filter

    @MainActor
    func testSearchMatchesTitleAndContentCaseInsensitively() async {
        let viewModel = makeViewModel()
        await viewModel.start()

        // Title match, different case ("Grandma's recipe card").
        viewModel.searchText = "GRANDMA"
        XCTAssertTrue(viewModel.displayedEntries.contains { $0.id == "demo-entry-04" })

        // Content-only match ("honey cake" appears in content).
        viewModel.searchText = "honey cake"
        XCTAssertTrue(viewModel.displayedEntries.contains { $0.id == "demo-entry-04" })

        // No match → empty, flagged as a filtered-empty (search) state.
        viewModel.searchText = "xyzzy-no-such-text"
        XCTAssertTrue(viewModel.displayedEntries.isEmpty)
        XCTAssertTrue(viewModel.isFilteredEmpty)

        // Clearing restores everything.
        viewModel.searchText = ""
        XCTAssertEqual(viewModel.displayedEntries.count, viewModel.entries.count)
    }

    @MainActor
    func testSearchIsDiacriticInsensitive() async {
        let accented = JournalEntry(
            id: "accented-entry",
            userId: MockData.userId,
            type: .text,
            title: "Café réflexion",
            content: "Notes from the café."
        )
        let viewModel = makeViewModel(entries: [accented])
        await viewModel.start()

        viewModel.searchText = "cafe reflexion"
        XCTAssertEqual(viewModel.displayedEntries.map(\.id), ["accented-entry"])
    }

    // MARK: - Pagination

    @MainActor
    func testPaginationAppendsWithoutDuplicates() async {
        // 12 seeded entries with a page size of 5 → pages of 5, 5, 2.
        let viewModel = makeViewModel(pageSize: 5)
        await viewModel.start()

        XCTAssertEqual(viewModel.entries.count, 5)
        XCTAssertTrue(viewModel.hasMorePages)

        await viewModel.loadNextPage()
        XCTAssertEqual(viewModel.entries.count, 10)
        XCTAssertTrue(viewModel.hasMorePages)

        await viewModel.loadNextPage()
        XCTAssertEqual(viewModel.entries.count, 12)
        XCTAssertFalse(viewModel.hasMorePages, "A short page ends pagination")

        // No duplicates, newest first.
        let ids = viewModel.entries.map(\.id)
        XCTAssertEqual(ids.count, Set(ids).count, "Pages must not introduce duplicate entries")
        let sorted = viewModel.entries.map(\.createdAt)
        XCTAssertEqual(sorted, sorted.sorted(by: >), "Entries stay newest-first across pages")

        // Exhausted: further loads are no-ops.
        await viewModel.loadNextPage()
        XCTAssertEqual(viewModel.entries.count, 12)
    }

    @MainActor
    func testFirstPageFailureSetsLoadFailedAndRetryRecovers() async {
        let repository = FailingJournalRepository()
        let viewModel = JournalListViewModel(journals: repository, pageSize: 5)

        await viewModel.start()
        XCTAssertTrue(viewModel.loadFailed, "A failed first page surfaces as an error state")
        XCTAssertFalse(viewModel.isLoadingFirstPage)
        XCTAssertTrue(viewModel.entries.isEmpty)

        repository.pagesShouldFail = false
        await viewModel.retryFirstPage()

        XCTAssertFalse(viewModel.loadFailed)
        XCTAssertEqual(viewModel.entries.count, 5)
    }

    @MainActor
    func testFilteredPaginationChainsPagesUntilDisplayedRowsGrow() async {
        // 12 entries, page size 2: with the .voice filter active, pages full
        // of other types must auto-chain instead of stalling.
        let viewModel = makeViewModel(pageSize: 2)
        await viewModel.start()

        viewModel.filter = .type(.voice)
        var safety = 0
        while viewModel.hasMorePages && safety < 20 {
            safety += 1
            guard let last = viewModel.displayedEntries.last else {
                // No voice entry displayed yet — chain from the seam directly.
                await viewModel.loadNextPage()
                continue
            }
            let before = viewModel.displayedEntries.count
            await viewModel.loadNextPageIfNeeded(after: last)
            if viewModel.displayedEntries.count == before && !viewModel.hasMorePages {
                break
            }
        }

        let expectedVoiceCount = MockData.journalEntries.filter { $0.type == .voice }.count
        XCTAssertEqual(viewModel.displayedEntries.count, expectedVoiceCount,
                       "All voice entries are reachable despite filter-empty pages")
    }

    @MainActor
    func testLiveStreamMergeDoesNotDuplicateFirstPage() async {
        // The live stream re-emits the newest window on start; merging it
        // with the already-loaded first page must not duplicate anything.
        let viewModel = makeViewModel(pageSize: 5)
        await viewModel.start()

        // Let the live stream's initial emission land.
        try? await Task.sleep(nanoseconds: 100_000_000)

        let ids = viewModel.entries.map(\.id)
        XCTAssertEqual(ids.count, Set(ids).count)
        XCTAssertEqual(viewModel.entries.count, 5)
    }
}
