import Foundation

// The Story outline: the whole journal as nested periods, all time down to entries.
// Spec: docs/superpowers/specs/2026-09-28-story-accordion-design.md.
// Pure: no Firebase, no SwiftUI, so it unit-tests with plain values.

/// What an outline row is.
enum StoryNodeKind: Equatable, Sendable {
    case period(PeriodSummaryType)
    case entry
}

/// How a week relates to the month it's listed under. ISO weeks straddle months, so
/// a straddling week is listed under both, each time with only that month's days.
enum StoryContinuation: Equatable, Sendable {
    case none
    /// The week goes on into this later month (its label, e.g. "October 2026").
    case continuesInto(String)
    /// The week started in this earlier month.
    case continuedFrom(String)
}

struct StoryNode: Identifiable, Equatable, Sendable {
    /// `key.docId`; weeks add `@<month docId>` (a straddling week appears twice);
    /// entries are `entry_<entry id>`.
    let id: String
    /// Nil for entries.
    let key: PeriodKey?
    let kind: StoryNodeKind
    /// Periods: "September 2026", "Week of Mon 21 Sep 2026". Entries: local time "07:40".
    let label: String
    /// Periods: the summary title, nil until summarized. Entries: the entry title or "Untitled".
    let title: String?
    let sentence: String?
    let summary: String?
    /// The period contains today.
    let isCurrent: Bool
    /// The local day its summary was written, when it was written while the period was open.
    let openAsOfDay: Int?
    /// Entries inside the period. For a week, the whole week (its text covers all of it).
    let entryCount: Int
    let continuation: StoryContinuation
    let entryId: String?
    let entryType: JournalType?
    /// 1 to 10 from the summary's details; nil for entries and unsummarized periods.
    let salience: Int?
    /// The summary's anchors whose entries still exist, in the summary's order, at most 3.
    let quotes: [StoryQuote]
    /// High, low, turning, in that order, skipping any whose entry no longer exists.
    let keyMoments: [StoryKeyMoment]
    let threads: [String]
    var children: [StoryNode]

    var hasChildren: Bool { !children.isEmpty }
    /// Gets the gold dot. Salience is never shown as a number.
    var isStandout: Bool { (salience ?? 0) >= StoryOutline.standoutSalience }
}

/// A verbatim quote from one entry, under the period that cites it. `attribution`
/// is "Tue 29 Sep 2026 · <entry title>".
struct StoryQuote: Equatable, Sendable {
    let entryId: String
    let quote: String
    let attribution: String
}

enum StoryKeyMomentKind: String, Equatable, Sendable {
    case high, low, turning

    var heading: String {
        switch self {
        case .high: return "High point"
        case .low: return "Low point"
        case .turning: return "Turning point"
        }
    }
}

/// An entry the period summary named as its high, low, or turning point.
struct StoryKeyMoment: Equatable, Sendable {
    let kind: StoryKeyMomentKind
    let entryId: String
    /// The entry title, or "Untitled".
    let title: String
    /// The entry's local day, "Thu 1 Oct 2026".
    let attribution: String
}

/// One visible row of the flattened outline.
struct StoryRow: Identifiable, Equatable, Sendable {
    let node: StoryNode
    let depth: Int
    var id: String { node.id }
}

/// One row of Home's "Your story" recap card. Tapping it opens the outline focused
/// on `key`. Spec: Entry points, "The Home card".
struct StoryHomeRow: Identifiable, Equatable, Sendable {
    let key: PeriodKey
    /// "This week so far · 4 entries · as of Thu". The view uppercases it.
    let label: String
    let title: String
    let sentence: String
    /// Gets the gold dot, same threshold as the outline.
    let isStandout: Bool

    var id: String { key.docId }

    /// VoiceOver reads each row as one link: "<label>, <title>. <sentence>".
    var accessibilityLabel: String {
        "\(label), \(title)\(isStandout ? ", a standout period" : ""). \(sentence)"
    }
}

/// What Home's card rows depend on, so a reappearance can skip re-reading entries
/// when nothing changed: the local day, each summary's key and write time, and the
/// newest entry. Spec: Entry points, "The Home card".
struct StoryHomeCacheKey: Equatable, Sendable {
    struct Stamp: Equatable, Sendable {
        let key: PeriodKey
        let generatedAt: Date
    }

    let today: Int
    /// Sorted by doc id, so the read order doesn't matter.
    let summaries: [Stamp]
    let newestEntryId: String?
    let newestEntryCreatedAt: Date?
}

enum StoryOutline {

    /// Salience at or above which a period is marked as a standout.
    static let standoutSalience = 8

    /// The outline for `entries`, with `summaries` overlaid, or nil when there are no
    /// usable entries. Days are LOCAL days in `timeZone`, matching period summaries.
    /// Entries are filtered with the planner's own rule, so the outline and the
    /// summaries agree on which entries count.
    static func build(
        entries: [JournalEntry],
        summaries: [PeriodKey: PeriodSummary],
        today: Int,
        timeZone: TimeZone
    ) -> StoryNode? {
        var byDay: [Int: [JournalEntry]] = [:]
        for entry in entries where !PeriodSummaryPlanner.entryText(entry).isEmpty {
            byDay[PeriodSummaryIndex.localDayIndex(for: entry.createdAt, in: timeZone), default: []].append(entry)
        }
        guard !byDay.isEmpty else { return nil }
        let days = byDay.keys.sorted(by: >)
        var weekDays: [PeriodKey: [Int]] = [:]
        for day in days { weekDays[PeriodSummaryIndex.key(.week, forDay: day), default: []].append(day) }
        let entriesById = Dictionary(byDay.values.joined().map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let ctx = Context(byDay: byDay, weekDays: weekDays, entriesById: entriesById,
                          summaries: summaries, today: today, timeZone: timeZone)

        let years = group(days, by: .year).map { year in
            periodNode(year.key, days: year.days, ctx, children: group(year.days, by: .quarter).map { quarter in
                periodNode(quarter.key, days: quarter.days, ctx, children: group(quarter.days, by: .month).map { month in
                    periodNode(month.key, days: month.days, ctx, children: weeks(inMonth: month.key, days: month.days, ctx))
                })
            })
        }
        return periodNode(PeriodKey(.all, 0), days: days, ctx, children: years)
    }

    /// Opens the path from the root to the current month, or to the latest month with
    /// entries when this month has none yet.
    static func defaultExpanded(_ root: StoryNode, today: Int) -> Set<String> {
        let current = PeriodSummaryIndex.key(.month, forDay: today)
        let path = path(in: root) { $0.key == current }
            ?? path(in: root) { $0.kind == .period(.month) }
            ?? [root]
        return Set(path.map(\.id))
    }

    /// Opens the outline on one period: every node from the root down to it, plus the
    /// node itself. Empty when the period isn't in the outline (no entries left in it);
    /// callers fall back to `defaultExpanded`.
    static func expanded(for focus: PeriodKey, in root: StoryNode) -> Set<String> {
        Set((focusPath(focus, in: root) ?? []).map(\.id))
    }

    /// The id of the row `focus` opens to, which the screen scrolls to.
    static func nodeId(for focus: PeriodKey, in root: StoryNode) -> String? {
        focusPath(focus, in: root)?.last?.id
    }

    /// Depth-first, children only under expanded nodes.
    static func visibleRows(_ root: StoryNode?, expanded: Set<String>) -> [StoryRow] {
        guard let root else { return [] }
        var rows: [StoryRow] = []
        func walk(_ node: StoryNode, _ depth: Int) {
            rows.append(StoryRow(node: node, depth: depth))
            guard expanded.contains(node.id) else { return }
            for child in node.children { walk(child, depth + 1) }
        }
        walk(root, 0)
        return rows
    }

    /// "October 2026 · 2 entries · so far". The view uppercases it.
    static func labelLine(_ node: StoryNode) -> String {
        var parts = [node.label, node.entryCount == 1 ? "1 entry" : "\(node.entryCount) entries"]
        if node.isCurrent { parts.append("so far") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Home card

    /// The summaries the Home card can show, in row order: this week, last week,
    /// the previous calendar month, the previous calendar quarter. Month and quarter
    /// indexes are `year * 12 + month0` and `year * 4 + quarter0`, so subtracting one
    /// crosses a year boundary correctly (1 January gives December and Q4).
    static func homeKeys(today: Int) -> [PeriodKey] {
        [
            PeriodSummaryIndex.key(.week, forDay: today),
            PeriodSummaryIndex.key(.week, forDay: today - 7),
            PeriodKey(.month, PeriodSummaryIndex.key(.month, forDay: today).index - 1),
            PeriodKey(.quarter, PeriodSummaryIndex.key(.quarter, forDay: today).index - 1),
        ]
    }

    /// The oldest local day any Home row counts: the first day of the previous
    /// quarter. Last week and the previous month always start on or after it.
    static func homeEntriesStartDay(today: Int) -> Int {
        firstDay(ofQuarter: homeKeys(today: today)[3].index)
    }

    /// Up to three recap rows (spec, Entry points, "The Home card"):
    /// 1. this ISO week "so far", with "as of <weekday>" when it was written before
    ///    today; else last week; else nothing;
    /// 2. the previous calendar month; 3. the previous calendar quarter.
    /// A period without a summary is hidden; nothing else fills the gap. Home never
    /// regenerates, so these are whatever is stored. `entries` only supplies counts
    /// and may include older entries, which are ignored.
    /// `countsComplete` false (the entry read stopped at its page cap) drops the
    /// " · N entries" part rather than show a low count.
    static func homeRows(
        summaries: [PeriodSummary],
        entries: [JournalEntry],
        today: Int,
        timeZone: TimeZone,
        countsComplete: Bool = true
    ) -> [StoryHomeRow] {
        let byKey = Dictionary(summaries.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        let keys = homeKeys(today: today)
        let days = entries
            .filter { !PeriodSummaryPlanner.entryText($0).isEmpty }
            .map { PeriodSummaryIndex.localDayIndex(for: $0.createdAt, in: timeZone) }

        func counted(_ label: String, _ key: PeriodKey) -> String {
            guard countsComplete else { return label }
            let count = days.filter { PeriodSummaryIndex.key(key.type, forDay: $0) == key }.count
            return "\(label) · \(count == 1 ? "1 entry" : "\(count) entries")"
        }
        func row(_ summary: PeriodSummary, _ label: String) -> StoryHomeRow {
            StoryHomeRow(key: summary.key, label: label, title: summary.title, sentence: summary.sentence,
                         isStandout: (summary.details.salience ?? 0) >= standoutSalience)
        }

        var rows: [StoryHomeRow] = []
        if let week = byKey[keys[0]] {
            var label = counted("This week so far", week.key)
            let writtenDay = PeriodSummaryIndex.localDayIndex(for: week.generatedAt, in: timeZone)
            if writtenDay < today { label += " · as of \(weekdayLabel(writtenDay))" }
            rows.append(row(week, label))
        } else if let lastWeek = byKey[keys[1]] {
            rows.append(row(lastWeek, counted("Last week", lastWeek.key)))
        }
        if let month = byKey[keys[2]] {
            let name = PeriodSummaryIndex.label(for: month.key, sampleDay: firstDay(ofMonth: month.key.index))
            rows.append(row(month, counted(name, month.key)))
        }
        if let quarter = byKey[keys[3]] {
            let name = PeriodSummaryIndex.label(for: quarter.key, sampleDay: firstDay(ofQuarter: quarter.key.index))
            rows.append(row(quarter, counted(name, quarter.key)))
        }
        return rows
    }

    /// The Home card's cache key. See `StoryHomeCacheKey`.
    static func homeCacheKey(today: Int, summaries: [PeriodSummary], newestEntry: JournalEntry?) -> StoryHomeCacheKey {
        StoryHomeCacheKey(
            today: today,
            summaries: summaries
                .map { StoryHomeCacheKey.Stamp(key: $0.key, generatedAt: $0.generatedAt) }
                .sorted { $0.key.docId < $1.key.docId },
            newestEntryId: newestEntry?.id,
            newestEntryCreatedAt: newestEntry?.createdAt
        )
    }

    /// Whether Home must re-read entries: nothing cached yet, or the key moved.
    static func homeNeedsRecount(cached: StoryHomeCacheKey?, current: StoryHomeCacheKey) -> Bool {
        cached != current
    }

    /// Entries newest first, a page at a time, until a page reaches back before
    /// `startDay` (a local day) or comes back empty (the start of the journal). A
    /// short page doesn't end paging: the repository drops undecodable docs, so a
    /// short page may still have more behind it. Stopping at `maxPages` first means
    /// the counts are incomplete. Nil when a read fails.
    static func homeEntries(
        since startDay: Int,
        timeZone: TimeZone,
        pageSize: Int,
        maxPages: Int,
        fetch: (Date?, Int) async throws -> [JournalEntry]
    ) async -> (entries: [JournalEntry], countsComplete: Bool)? {
        var all: [JournalEntry] = []
        var cursor: Date?
        for _ in 0..<maxPages {
            guard let page = try? await fetch(cursor, pageSize) else { return nil }
            guard let last = page.last else { return (all, true) }
            all += page
            if PeriodSummaryIndex.localDayIndex(for: last.createdAt, in: timeZone) < startDay { return (all, true) }
            cursor = last.createdAt
        }
        return (all, false)
    }

    /// "07:40" in `timeZone`. Built from calendar components rather than a
    /// DateFormatter, which is costly to create once per entry.
    static func timeLabel(_ date: Date, _ timeZone: TimeZone) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }

    // MARK: - Building

    private struct Context {
        let byDay: [Int: [JournalEntry]]
        /// Every day with entries in each week, newest first, across months.
        let weekDays: [PeriodKey: [Int]]
        /// Usable entries by id, to resolve anchors and key scenes; a miss means deleted.
        let entriesById: [String: JournalEntry]
        let summaries: [PeriodKey: PeriodSummary]
        let today: Int
        let timeZone: TimeZone
    }

    /// Groups newest-first `days` by their `type` period. Groups and the days inside
    /// them stay newest first.
    private static func group(_ days: [Int], by type: PeriodSummaryType) -> [(key: PeriodKey, days: [Int])] {
        var order: [PeriodKey] = []
        var members: [PeriodKey: [Int]] = [:]
        for day in days {
            let key = PeriodSummaryIndex.key(type, forDay: day)
            if members[key] == nil { order.append(key) }
            members[key, default: []].append(day)
        }
        return order.map { (key: $0, days: members[$0]!) }
    }

    private static func weeks(inMonth month: PeriodKey, days monthDays: [Int], _ ctx: Context) -> [StoryNode] {
        group(monthDays, by: .week).map { week in
            let allDays = ctx.weekDays[week.key] ?? week.days
            func otherMonth(_ isOther: (Int) -> Bool) -> String? {
                guard let day = allDays.first(where: { isOther(PeriodSummaryIndex.key(.month, forDay: $0).index) })
                else { return nil }
                return PeriodSummaryIndex.label(for: PeriodSummaryIndex.key(.month, forDay: day), sampleDay: day)
            }
            let continuation: StoryContinuation
            if let later = otherMonth({ $0 > month.index }) {
                continuation = .continuesInto(later)
            } else if let earlier = otherMonth({ $0 < month.index }) {
                continuation = .continuedFrom(earlier)
            } else {
                continuation = .none
            }
            return periodNode(week.key, days: allDays, ctx, idSuffix: "@\(month.docId)",
                              continuation: continuation, children: week.days.map { dayNode($0, ctx) })
        }
    }

    private static func dayNode(_ day: Int, _ ctx: Context) -> StoryNode {
        let entries = (ctx.byDay[day] ?? []).sorted { $0.createdAt > $1.createdAt }
        return periodNode(PeriodKey(.day, day), days: [day], ctx, children: entries.map { entryNode($0, ctx) })
    }

    /// `days` is non-empty and newest first; `days[0]` supplies the label's sample day.
    private static func periodNode(
        _ key: PeriodKey,
        days: [Int],
        _ ctx: Context,
        idSuffix: String = "",
        continuation: StoryContinuation = .none,
        children: [StoryNode]
    ) -> StoryNode {
        let summary = ctx.summaries[key]
        let openAsOfDay = summary.flatMap {
            $0.isOpen ? PeriodSummaryIndex.localDayIndex(for: $0.generatedAt, in: ctx.timeZone) : nil
        }
        return StoryNode(
            id: key.docId + idSuffix,
            key: key,
            kind: .period(key.type),
            label: PeriodSummaryIndex.label(for: key, sampleDay: days[0]),
            title: summary?.title,
            sentence: summary?.sentence,
            summary: summary?.summary,
            isCurrent: PeriodSummaryIndex.isOpen(key, today: ctx.today),
            openAsOfDay: openAsOfDay,
            entryCount: days.reduce(0) { $0 + (ctx.byDay[$1]?.count ?? 0) },
            continuation: continuation,
            entryId: nil,
            entryType: nil,
            salience: summary?.details.salience,
            quotes: Array((summary?.details.anchors ?? []).compactMap { anchor in
                ctx.entriesById[anchor.entryId].map {
                    StoryQuote(entryId: anchor.entryId, quote: anchor.quote,
                               attribution: "\(entryDayLabel($0, ctx)) · \(entryTitle($0))")
                }
            }.prefix(3)),
            keyMoments: keyMoments(summary?.details.keyScenes ?? .none, ctx),
            threads: summary?.details.threads ?? [],
            children: children
        )
    }

    private static func keyMoments(_ scenes: PeriodSummaryKeyScenes, _ ctx: Context) -> [StoryKeyMoment] {
        let picks: [(StoryKeyMomentKind, String?)] = [(.high, scenes.high), (.low, scenes.low), (.turning, scenes.turning)]
        return picks.compactMap { kind, id in
            guard let id, let entry = ctx.entriesById[id] else { return nil }
            return StoryKeyMoment(kind: kind, entryId: id, title: entryTitle(entry), attribution: entryDayLabel(entry, ctx))
        }
    }

    private static func entryTitle(_ entry: JournalEntry) -> String {
        let title = entry.title.trimmingCharacters(in: .whitespacesAndNewlines)
        return title.isEmpty ? "Untitled" : title
    }

    private static func entryDayLabel(_ entry: JournalEntry, _ ctx: Context) -> String {
        PeriodSummaryIndex.dayLabel(PeriodSummaryIndex.localDayIndex(for: entry.createdAt, in: ctx.timeZone))
    }

    private static func entryNode(_ entry: JournalEntry, _ ctx: Context) -> StoryNode {
        StoryNode(
            id: "entry_\(entry.id)",
            key: nil,
            kind: .entry,
            label: timeLabel(entry.createdAt, ctx.timeZone),
            title: entryTitle(entry),
            sentence: nil,
            summary: nil,
            isCurrent: false,
            openAsOfDay: nil,
            entryCount: 1,
            continuation: .none,
            entryId: entry.id,
            entryType: entry.type,
            salience: nil,
            quotes: [],
            keyMoments: [],
            threads: [],
            children: []
        )
    }

    /// Nodes from `node` down to the first match, depth-first in display order
    /// (newest first). Doesn't descend below months, so it never walks days or entries.
    private static func path(in node: StoryNode, _ match: (StoryNode) -> Bool) -> [StoryNode]? {
        if match(node) { return [node] }
        guard case .period(let type) = node.kind, type.rank > PeriodSummaryType.month.rank else { return nil }
        for child in node.children {
            if let rest = path(in: child, match) { return [node] + rest }
        }
        return nil
    }

    // MARK: - Focus

    /// The path to the node `focus` opens. A straddling week is listed under two
    /// months; prefer the listing under the month holding its Thursday (ISO's month
    /// for the week), else the first listing in display order.
    private static func focusPath(_ focus: PeriodKey, in root: StoryNode) -> [StoryNode]? {
        let listings = paths(to: focus, in: root)
        guard let first = listings.first else { return nil }
        guard focus.type == .week, let sampleDay = first.last?.children.first?.key?.index else { return first }
        let thursdayMonth = PeriodSummaryIndex.key(.month, forDay: PeriodIndex.thursdayDayIndex(forDayIndex: sampleDay))
        return listings.first { $0.last?.id == "\(focus.docId)@\(thursdayMonth.docId)" } ?? first
    }

    /// Every path from `node` to a node with key `focus`, in display order. Only
    /// descends through tiers above the focus tier, so it never walks entries.
    private static func paths(to focus: PeriodKey, in node: StoryNode) -> [[StoryNode]] {
        if node.key == focus { return [[node]] }
        guard case .period(let type) = node.kind, type.rank > focus.type.rank else { return [] }
        return node.children.flatMap { child in paths(to: focus, in: child).map { [node] + $0 } }
    }

    // MARK: - Calendar helpers

    /// "Thu". `dayLabel` is `EEE d MMM yyyy` in `en_US_POSIX`, so its first three
    /// characters are the weekday.
    private static func weekdayLabel(_ day: Int) -> String {
        String(PeriodSummaryIndex.dayLabel(day).prefix(3))
    }

    private static func firstDay(ofMonth index: Int) -> Int {
        firstDay(year: index / 12, month: index % 12 + 1)
    }

    private static func firstDay(ofQuarter index: Int) -> Int {
        firstDay(year: index / 4, month: index % 4 * 3 + 1)
    }

    /// Day index of the 1st of `month` (1-based), in the same UTC-midnight encoding
    /// as `PeriodSummaryIndex.localDayIndex`.
    private static func firstDay(year: Int, month: Int) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let date = calendar.date(from: DateComponents(year: year, month: month, day: 1))!
        return Int(floor(date.timeIntervalSince1970 / 86_400))
    }
}
