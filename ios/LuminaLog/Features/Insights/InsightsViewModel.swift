import Foundation
import OSLog

/// Loads all entries once and computes the four insight datasets off the main
/// thread. Logs elapsed time for fetch + each analyzer so we can measure real
/// device cost as journals grow (ADR-0032, plan item #1).
@MainActor
final class InsightsViewModel: ObservableObject {

    /// Render-ready datasets for the dashboard. The `show*` predicates are the
    /// single source of truth for which cards are meaningful enough to render —
    /// shared by `InsightsView` (which card to show) and `load()` (whether the
    /// loaded state has any card at all, else it collapses to `.empty`).
    struct Insights: Equatable {
        var words: [WordFrequency]
        var emotionTrend: [EmotionTrendPoint]
        var activity: [ActivityDay]
        var types: [EntryTypeSlice]

        /// Show the word cloud once there are any words.
        var showWords: Bool { !words.isEmpty }
        /// Show the emotion trend once any entry carries a dominant emotion.
        var showEmotionTrend: Bool { !emotionTrend.isEmpty }
        /// Show the heatmap once there's at least one active day in the window
        /// (the array is always dense, so `.isEmpty` is never the right gate).
        var showActivity: Bool { activity.contains { $0.entryCount > 0 } }
        /// A single slice isn't a "breakdown" — need at least two types.
        var showTypes: Bool { types.count > 1 }
        /// Whether any card would render at all.
        var hasAnyCard: Bool { showWords || showEmotionTrend || showActivity || showTypes }
    }

    enum State: Equatable {
        case idle
        case loading
        case loaded(Insights)
        case empty
        case failed
    }

    @Published private(set) var state: State = .idle

    private let journals: JournalRepository
    private static let log = Logger(subsystem: "com.konradgnat.luminalog", category: "insights")
    private static let signposter = OSSignposter(subsystem: "com.konradgnat.luminalog", category: "insights")

    /// How far back the activity heatmap reaches (17 weeks ≈ 4 months).
    private let activityWindowDays = 119

    init(journals: JournalRepository) {
        self.journals = journals
    }

    func load() async {
        state = .loading
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        // Fall back to `today` (an empty same-day window) rather than `Date()`,
        // which could invert the interval and trap DateInterval.
        let window = DateInterval(
            start: calendar.date(byAdding: .day, value: -activityWindowDays, to: today) ?? today,
            end: today
        )

        do {
            let entries = try await fetchTimed()

            guard !entries.isEmpty else { state = .empty; return }

            let analyzeStart = ContinuousClock.now
            let insights = await Self.analyze(entries: entries, window: window, calendar: calendar)
            let analyzeMs = analyzeStart.duration(to: .now).milliseconds
            Self.log.info("insights analysis: \(analyzeMs, format: .fixed(precision: 1)) ms for \(entries.count) entries")

            // Entries exist but produced no meaningful card (e.g. a couple of
            // short, single-type, unscored entries) → show the empty state
            // rather than a blank scroll.
            state = insights.hasAnyCard ? .loaded(insights) : .empty
        } catch {
            Self.log.error("insights load failed: \(error.localizedDescription, privacy: .public)")
            state = .failed
        }
    }

    func retry() async { await load() }

    /// Fetches all entries, bracketing just the fetch in a signpost interval
    /// (closed via `defer`, so it never leaks if the fetch throws) and logging
    /// the elapsed time. Rethrows so `load()` can transition to `.failed`.
    private func fetchTimed() async throws -> [JournalEntry] {
        let fetchState = Self.signposter.beginInterval("fetchAllEntries")
        defer { Self.signposter.endInterval("fetchAllEntries", fetchState) }
        let fetchStart = ContinuousClock.now
        let entries = try await journals.fetchAllEntries()
        let fetchMs = fetchStart.duration(to: .now).milliseconds
        Self.log.info("fetchAllEntries: \(entries.count) entries in \(fetchMs, format: .fixed(precision: 1)) ms")
        return entries
    }

    /// Runs the pure analyzers off the main actor. `JournalEntry` is `Sendable`.
    private static func analyze(entries: [JournalEntry], window: DateInterval,
                                calendar: Calendar) async -> Insights {
        await Task.detached(priority: .userInitiated) {
            let wordsStart = ContinuousClock.now
            let words = WordFrequencyAnalyzer.topWords(from: entries, limit: 50)
            log.info("word frequency (NLP): \(wordsStart.duration(to: .now).milliseconds, format: .fixed(precision: 1)) ms")

            let emotionTrend = InsightsAggregates.emotionTrend(from: entries, calendar: calendar)
            let activity = InsightsAggregates.activity(from: entries, window: window, calendar: calendar)
            let types = InsightsAggregates.typeBreakdown(from: entries)
            return Insights(words: words, emotionTrend: emotionTrend, activity: activity, types: types)
        }.value
    }
}

private extension Duration {
    /// Elapsed milliseconds as a Double, for logging.
    var milliseconds: Double {
        let c = components
        return Double(c.seconds) * 1000 + Double(c.attoseconds) / 1_000_000_000_000_000
    }
}
