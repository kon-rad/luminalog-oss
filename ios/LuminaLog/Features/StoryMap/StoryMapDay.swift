import Foundation

/// One entry on a day dot's chip row.
struct StoryMapDayChip: Identifiable, Equatable, Sendable {
    let id: String
    /// The entry title, or its local time ("07:30") when untitled.
    let label: String
}

/// Which entries a day dot holds. The paused build showed only the newest entry of
/// a UTC day; this buckets by LOCAL day (profile timezone, like the summaries) and
/// offers every entry. Spec: docs/superpowers/specs/2026-09-28-story-map-design.md, "Day tier".
enum StoryMapDay {

    /// Entries on local `day`, newest first. Uses the summaries planner's filter, so
    /// an entry with no usable text is left out here exactly as it is in the Story view.
    static func entries(onDay day: Int, from entries: [JournalEntry], timeZone: TimeZone) -> [JournalEntry] {
        entries
            .filter {
                PeriodSummaryIndex.localDayIndex(for: $0.createdAt, in: timeZone) == day
                    && !PeriodSummaryPlanner.entryText($0).isEmpty
            }
            .sorted { $0.createdAt > $1.createdAt }
    }

    static func chips(_ entries: [JournalEntry], timeZone: TimeZone) -> [StoryMapDayChip] {
        entries.map { entry in
            let title = entry.title.trimmingCharacters(in: .whitespacesAndNewlines)
            return StoryMapDayChip(id: entry.id,
                                   label: title.isEmpty ? StoryOutline.timeLabel(entry.createdAt, timeZone) : title)
        }
    }
}
