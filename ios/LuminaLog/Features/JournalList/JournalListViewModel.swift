import Foundation
import OSLog

/// Drives the Journal list (design §3): pagination, live updates of the
/// newest page, client-side type filter + search, and date grouping.
@MainActor
final class JournalListViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "journal-list")

    // MARK: - Filter

    /// Type filter chips: All / Text / Voice / Video / Image.
    enum TypeFilter: Hashable {
        case all
        case type(JournalType)

        static let allFilters: [TypeFilter] = [.all] + JournalType.allCases.map { .type($0) }

        var title: String {
            switch self {
            case .all: return "All"
            case .type(let type): return type.displayName
            }
        }
    }

    // MARK: - Sections

    /// A date-grouped section of the displayed entries.
    struct EntrySection: Identifiable, Equatable {
        let title: String
        let entries: [JournalEntry]
        var id: String { title }
    }

    // MARK: - Published state

    /// All loaded entries, newest first (paginated + live-merged).
    @Published private(set) var entries: [JournalEntry] = []
    @Published private(set) var isLoadingFirstPage = true
    @Published private(set) var isLoadingNextPage = false
    @Published var searchText = ""
    @Published var filter: TypeFilter = .all

    /// False once a page comes back shorter than `pageSize`.
    private(set) var hasMorePages = true

    private let journals: JournalRepository
    private let pageSize: Int
    private var liveTask: Task<Void, Never>?
    private var hasStarted = false

    init(journals: JournalRepository, pageSize: Int = 20) {
        self.journals = journals
        self.pageSize = pageSize
    }

    deinit {
        liveTask?.cancel()
    }

    // MARK: - Lifecycle

    /// Loads the first page and starts the live stream. Idempotent — the
    /// list stays mounted across tab switches.
    func start() async {
        guard !hasStarted else { return }
        hasStarted = true
        await loadFirstPage()
        startLiveUpdates()
    }

    private func loadFirstPage() async {
        defer { isLoadingFirstPage = false }
        do {
            let page = try await journals.entries(after: nil, limit: pageSize)
            hasMorePages = page.count == pageSize
            mergeLatest(page)
        } catch {
            Self.logger.error("first page failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Mirrors `recentEntries` so creates/edits/deletes show up live.
    private func startLiveUpdates() {
        liveTask = Task { [weak self] in
            guard let stream = self?.journals.recentEntries(limit: self?.pageSize ?? 20) else { return }
            for await latest in stream {
                guard let self, !Task.isCancelled else { return }
                self.mergeLatest(latest)
            }
        }
    }

    // MARK: - Pagination

    /// Call when `entry` (the last displayed row) appears.
    func loadNextPageIfNeeded(after entry: JournalEntry) async {
        guard entry.id == displayedEntries.last?.id else { return }
        await loadNextPage()
    }

    func loadNextPage() async {
        guard hasMorePages, !isLoadingNextPage, !isLoadingFirstPage else { return }
        isLoadingNextPage = true
        defer { isLoadingNextPage = false }
        do {
            let page = try await journals.entries(after: entries.last?.createdAt, limit: pageSize)
            hasMorePages = page.count == pageSize
            append(page)
        } catch {
            Self.logger.error("next page failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Appends a page, skipping any entry already loaded (an entry can move
    /// across page boundaries while paging).
    private func append(_ page: [JournalEntry]) {
        let loadedIds = Set(entries.map(\.id))
        entries += page.filter { !loadedIds.contains($0.id) }
    }

    // MARK: - Live merge

    /// Merges a `recentEntries` emission into the loaded list.
    ///
    /// Kept deliberately simple: the live stream is authoritative for the
    /// newest `pageSize`-sized window — creates, edits, and deletes there
    /// replace whatever was loaded (newest wins by id). Entries strictly
    /// older than the window's oldest item came from pagination and are
    /// kept as-is; deletions of those older entries are not reflected until
    /// the screen is recreated (acceptable for v1).
    private func mergeLatest(_ latest: [JournalEntry]) {
        let latestIds = Set(latest.map(\.id))
        let windowStart = latest.last?.createdAt
        let older = entries.filter { entry in
            guard !latestIds.contains(entry.id) else { return false }
            // Empty stream means the user has no entries at all.
            guard let windowStart else { return false }
            return entry.createdAt < windowStart
        }
        entries = latest + older
    }

    // MARK: - Filtering & search

    /// Loaded entries after the type filter and search are applied.
    var displayedEntries: [JournalEntry] {
        entries.filter { matchesFilter($0) && matchesSearch($0) }
    }

    /// True when the empty result comes from an active search/filter
    /// rather than an empty journal.
    var isFilteredEmpty: Bool {
        displayedEntries.isEmpty && !entries.isEmpty
    }

    private func matchesFilter(_ entry: JournalEntry) -> Bool {
        switch filter {
        case .all: return true
        case .type(let type): return entry.type == type
        }
    }

    /// Case- and diacritic-insensitive match over title + content.
    private func matchesSearch(_ entry: JournalEntry) -> Bool {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return true }
        let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]
        return entry.title.range(of: query, options: options) != nil
            || entry.content.range(of: query, options: options) != nil
    }

    // MARK: - Date grouping

    /// Displayed entries grouped into "Today", "This Week", then "Month Year"
    /// sections (entries are newest-first, so section keys are monotonic).
    var sections: [EntrySection] {
        let calendar = Calendar.current
        let now = Date()
        var ordered: [(title: String, entries: [JournalEntry])] = []

        for entry in displayedEntries {
            let title = sectionTitle(for: entry.createdAt, now: now, calendar: calendar)
            if let last = ordered.indices.last, ordered[last].title == title {
                ordered[last].entries.append(entry)
            } else {
                ordered.append((title, [entry]))
            }
        }
        return ordered.map { EntrySection(title: $0.title, entries: $0.entries) }
    }

    private func sectionTitle(for date: Date, now: Date, calendar: Calendar) -> String {
        if calendar.isDate(date, inSameDayAs: now) {
            return "Today"
        }
        if calendar.isDate(date, equalTo: now, toGranularity: .weekOfYear) {
            return "This Week"
        }
        return date.formatted(.dateTime.month(.wide).year())
    }
}
