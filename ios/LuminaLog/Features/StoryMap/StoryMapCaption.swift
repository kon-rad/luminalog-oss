import Foundation

/// A verbatim quote from one entry, shown under the caption's summary.
struct StoryMapQuote: Equatable, Sendable {
    let entryId: String
    let quote: String
    /// The entry's local day, "Tue 22 Sep 2026".
    let attribution: String
}

/// The entry the period summary named as its high point.
struct StoryMapHighPoint: Equatable, Sendable {
    let entryId: String
    /// The entry title, or "Untitled".
    let title: String
    let attribution: String
}

/// What the Map's caption bar shows for the focused dot. Text comes only from the
/// period summaries store, so the Map and the Story view never disagree.
/// Spec: docs/superpowers/specs/2026-09-28-story-map-design.md, "Captions".
struct StoryMapCaption: Equatable, Sendable {
    /// The summary key (after translation from the pyramid's address).
    let key: PeriodKey
    /// "Week of Mon 21 Sep 2026 · 5 days · so far · as of Thu 24 Sep". The view uppercases it.
    let labelLine: String
    /// Nil until summarized; the view shows "Not summarized yet".
    let title: String?
    let sentence: String?
    let summary: String?
    /// The first anchor whose entry still exists.
    let quote: StoryMapQuote?
    let highPoint: StoryMapHighPoint?
    /// Salience at or above `StoryOutline.standoutSalience`: the same gold dot as the outline.
    let isStandout: Bool

    /// `childCount` is the renderer's child count for every tier but `day`, where the
    /// caller passes the number of entries on that local day (the pyramid stores 1).
    static func make(
        summary: PeriodSummary?,
        key: PeriodKey,
        childCount: Int,
        entriesById: [String: JournalEntry],
        today: Int,
        timeZone: TimeZone
    ) -> StoryMapCaption {
        var parts = [
            PeriodSummaryIndex.label(for: key, sampleDay: StoryMapKeys.sampleDay(for: key)),
            childCountLabel(key.type, count: childCount),
        ]
        if PeriodSummaryIndex.isOpen(key, today: today) {
            parts.append("so far")
            if let summary {
                let written = PeriodSummaryIndex.localDayIndex(for: summary.generatedAt, in: timeZone)
                if written != today { parts.append("as of \(shortDayLabel(written))") }
            }
        }
        let details = summary?.details ?? .empty
        let quote = details.anchors.lazy.compactMap { anchor -> StoryMapQuote? in
            guard let entry = entriesById[anchor.entryId] else { return nil }
            return StoryMapQuote(entryId: anchor.entryId, quote: anchor.quote,
                                 attribution: dayLabel(entry, timeZone))
        }.first
        let highPoint = details.keyScenes.high.flatMap { id -> StoryMapHighPoint? in
            guard let entry = entriesById[id] else { return nil }
            return StoryMapHighPoint(entryId: id, title: title(entry), attribution: dayLabel(entry, timeZone))
        }
        return StoryMapCaption(
            key: key,
            labelLine: parts.joined(separator: " · "),
            title: summary?.title,
            sentence: summary?.sentence,
            summary: summary?.summary,
            quote: quote,
            highPoint: highPoint,
            isStandout: (details.salience ?? 0) >= StoryOutline.standoutSalience
        )
    }

    /// What a dot of `type` is made of in the pyramid: a week of days, a month of
    /// weeks, all time of years. A day is made of entries.
    static func childCountLabel(_ type: PeriodSummaryType, count: Int) -> String {
        let noun: (String, String)
        switch type {
        case .day: noun = ("entry", "entries")
        case .week: noun = ("day", "days")
        case .month: noun = ("week", "weeks")
        case .quarter: noun = ("month", "months")
        case .year: noun = ("quarter", "quarters")
        case .all: noun = ("year", "years")
        }
        return "\(count) \(count == 1 ? noun.0 : noun.1)"
    }

    private static func title(_ entry: JournalEntry) -> String {
        let trimmed = entry.title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Untitled" : trimmed
    }

    private static func dayLabel(_ entry: JournalEntry, _ timeZone: TimeZone) -> String {
        PeriodSummaryIndex.dayLabel(PeriodSummaryIndex.localDayIndex(for: entry.createdAt, in: timeZone))
    }

    /// "Thu 24 Sep" (no year: the period label above already carries it).
    private static func shortDayLabel(_ dayIndex: Int) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(dayIndex) * 86_400))
    }
}
