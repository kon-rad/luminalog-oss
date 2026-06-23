import Foundation

/// Pure, metadata-only aggregations for the Insights dashboard (no NLP, no
/// decryption beyond what the entries already carry). See ADR-0032.
enum InsightsAggregates {

    /// Count of entries per type, descending by count (ties by enum order).
    static func typeBreakdown(from entries: [JournalEntry]) -> [EntryTypeSlice] {
        var counts: [JournalType: Int] = [:]
        for e in entries { counts[e.type, default: 0] += 1 }
        return JournalType.allCases
            .compactMap { type in counts[type].map { EntryTypeSlice(type: type, count: $0) } }
            .sorted { a, b in
                // Count descending; on a tie, ascending enum order (text→image).
                a.count != b.count ? a.count > b.count : slot(a.type) < slot(b.type)
            }
    }

    /// Daily count of entries grouped by their dominant emotion (`emotion.top.first`).
    /// Entries without an emotion score are skipped. Sorted by date then emotion.
    static func emotionTrend(from entries: [JournalEntry],
                             calendar: Calendar = .current) -> [EmotionTrendPoint] {
        struct Key: Hashable { let day: Date; let emotion: String }
        var counts: [Key: Int] = [:]
        for e in entries {
            guard let dominant = e.emotion?.top.first?.name, !dominant.isEmpty else { continue }
            let day = calendar.startOfDay(for: e.createdAt)
            counts[Key(day: day, emotion: dominant), default: 0] += 1
        }
        return counts
            .map { EmotionTrendPoint(date: $0.key.day, emotion: $0.key.emotion, count: $0.value) }
            .sorted { ($0.date, $0.emotion) < ($1.date, $1.emotion) }
    }

    /// One `ActivityDay` for every day in `window` (dense, including zero days),
    /// so the heatmap grid has no holes. `window.end` day is included.
    static func activity(from entries: [JournalEntry],
                         window: DateInterval,
                         calendar: Calendar = .current) -> [ActivityDay] {
        var entryCounts: [Date: Int] = [:]
        var wordCounts: [Date: Int] = [:]
        for e in entries {
            let day = calendar.startOfDay(for: e.createdAt)
            guard day >= window.start, day <= window.end else { continue }
            entryCounts[day, default: 0] += 1
            wordCounts[day, default: 0] += e.wordCount
        }

        var days: [ActivityDay] = []
        var cursor = calendar.startOfDay(for: window.start)
        let last = calendar.startOfDay(for: window.end)
        while cursor <= last {
            days.append(ActivityDay(date: cursor,
                                    entryCount: entryCounts[cursor] ?? 0,
                                    wordCount: wordCounts[cursor] ?? 0))
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return days
    }

    /// Stable ordering slot for a type (text, voice, video, image).
    private static func slot(_ type: JournalType) -> Int {
        JournalType.allCases.firstIndex(of: type) ?? 0
    }
}
