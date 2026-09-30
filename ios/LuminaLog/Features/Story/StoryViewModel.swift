import Foundation

/// Drives the Story screen. Dependencies are closures so tests need no Firebase.
/// Spec: docs/superpowers/specs/2026-09-28-story-accordion-design.md.
@MainActor
final class StoryViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        /// No usable entries at all.
        case empty
        case loaded
        /// Entries couldn't be read and there's nothing on screen to keep.
        case failed
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var rows: [StoryRow] = []
    @Published private(set) var expanded: Set<String> = []
    /// Entries exist but not one summary does yet (backfill hasn't reached them).
    @Published private(set) var awaitingSummaries = false
    @Published private(set) var consentOff = false
    /// The row to scroll to once, set by the first build when the screen opened on a
    /// focused period (a Home recap row). Never changes after that.
    @Published private(set) var scrollTarget: String?

    private let loadEntries: () async throws -> [JournalEntry]
    private let loadSummaries: () async throws -> [PeriodSummary]
    private let timeZone: () async -> TimeZone
    /// Runs the period summaries reconciler; returns how many summaries it wrote.
    private let reconcile: () async -> Int
    private let hasConsent: () -> Bool
    private let now: () -> Date
    /// Opens the outline on this period instead of "zoomed to now".
    private let focus: PeriodKey?

    private var root: StoryNode?
    private var entries: [JournalEntry] = []
    private var zone: TimeZone = .current
    private var hasStarted = false

    init(
        loadEntries: @escaping () async throws -> [JournalEntry],
        loadSummaries: @escaping () async throws -> [PeriodSummary],
        timeZone: @escaping () async -> TimeZone,
        reconcile: @escaping () async -> Int,
        hasConsent: @escaping () -> Bool,
        now: @escaping () -> Date = Date.init,
        focus: PeriodKey? = nil
    ) {
        self.loadEntries = loadEntries
        self.loadSummaries = loadSummaries
        self.timeZone = timeZone
        self.reconcile = reconcile
        self.hasConsent = hasConsent
        self.now = now
        self.focus = focus
    }

    /// First appearance: show what's stored, then refresh the open periods (reading
    /// the screen counts as reading them) and redraw if anything was written. Runs
    /// once per screen; coming back from an entry doesn't reload. Pull to refresh does.
    func start() async {
        guard !hasStarted else { return }
        hasStarted = true
        await load()
        guard state == .loaded else { return }
        await reconcileAndReload()
    }

    func load() async {
        if root == nil { state = .loading }
        consentOff = !hasConsent()
        do {
            entries = try await loadEntries()
        } catch {
            if root == nil { state = .failed }
            return
        }
        zone = await timeZone()
        // Summaries are an overlay: a failed read shows the outline without them.
        rebuild((try? await loadSummaries()) ?? [])
    }

    func reconcileAndReload() async {
        guard !consentOff else { return }
        guard await reconcile() > 0 else { return }
        rebuild((try? await loadSummaries()) ?? [])
    }

    func toggle(_ id: String) {
        if expanded.contains(id) { expanded.remove(id) } else { expanded.insert(id) }
        rows = StoryOutline.visibleRows(root, expanded: expanded)
    }

    private func rebuild(_ summaries: [PeriodSummary]) {
        let today = PeriodSummaryIndex.localDayIndex(for: now(), in: zone)
        let isFirstBuild = root == nil
        root = StoryOutline.build(
            entries: entries,
            summaries: Dictionary(summaries.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a }),
            today: today,
            timeZone: zone
        )
        guard let root else {
            rows = []
            state = .empty
            return
        }
        // Only the first build picks the expansion: later rebuilds keep what the
        // user opened and closed. A focus that isn't in the outline (its entries
        // were deleted) falls back to "zoomed to now".
        var target: String?
        if isFirstBuild {
            if let focus, let id = StoryOutline.nodeId(for: focus, in: root) {
                expanded = StoryOutline.expanded(for: focus, in: root)
                target = id
            } else {
                expanded = StoryOutline.defaultExpanded(root, today: today)
            }
        }
        awaitingSummaries = summaries.isEmpty
        rows = StoryOutline.visibleRows(root, expanded: expanded)
        state = .loaded
        // Last, so the rows it names are already published when the view scrolls.
        if let target { scrollTarget = target }
    }
}
