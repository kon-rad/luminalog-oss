import Foundation
import OSLog

/// Loads all entries once and computes the four insight datasets off the main
/// thread. Logs elapsed time for fetch + each analyzer so we can measure real
/// device cost as journals grow (ADR-0032, plan item #1).
@MainActor
final class InsightsViewModel: ObservableObject {

    /// Render-ready datasets for the dashboard.
    struct Insights: Equatable {
        var words: [WordFrequency]
        var emotionTrend: [EmotionTrendPoint]
        var activity: [ActivityDay]
        var types: [EntryTypeSlice]
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
        let window = DateInterval(
            start: calendar.date(byAdding: .day, value: -activityWindowDays,
                                 to: calendar.startOfDay(for: Date())) ?? Date(),
            end: calendar.startOfDay(for: Date())
        )

        do {
            let fetchState = Self.signposter.beginInterval("fetchAllEntries")
            let fetchStart = ContinuousClock.now
            let entries = try await journals.fetchAllEntries()
            let fetchMs = fetchStart.duration(to: .now).milliseconds
            Self.signposter.endInterval("fetchAllEntries", fetchState)
            Self.log.info("fetchAllEntries: \(entries.count) entries in \(fetchMs, format: .fixed(precision: 1)) ms")

            guard !entries.isEmpty else { state = .empty; return }

            let analyzeStart = ContinuousClock.now
            let insights = await Self.analyze(entries: entries, window: window, calendar: calendar)
            let analyzeMs = analyzeStart.duration(to: .now).milliseconds
            Self.log.info("insights analysis: \(analyzeMs, format: .fixed(precision: 1)) ms for \(entries.count) entries")

            state = .loaded(insights)
        } catch {
            Self.log.error("insights load failed: \(error.localizedDescription, privacy: .public)")
            state = .failed
        }
    }

    func retry() async { await load() }

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
