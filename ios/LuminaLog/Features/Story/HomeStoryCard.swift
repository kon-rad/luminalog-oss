import SwiftUI

/// Home's "Your story" card: up to three recap rows (this week so far, the last
/// finished month, the last finished quarter), each opening the Story screen focused
/// on its period, and an "Open your story" button.
/// Spec: docs/superpowers/specs/2026-09-28-story-accordion-design.md, Entry points,
/// "The Home card". Home never runs the reconciler: it shows what is stored.
struct HomeStoryCard: View {

    @EnvironmentObject private var services: AppServices
    /// Nil until the first load finishes.
    @State private var rows: [StoryHomeRow]?
    /// What `rows` was computed from; an unchanged key skips re-reading entries.
    @State private var cacheKey: StoryHomeCacheKey?

    private static let pageSize = 100
    /// Runaway guard: 3,000 entries in one quarter and a bit.
    private static let maxPages = 30

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            SectionHeader(title: "Your story")

            VStack(alignment: .leading, spacing: 0) {
                if let rows, !rows.isEmpty {
                    ForEach(rows) { row in
                        recapRow(row)
                        Divider()
                    }
                } else {
                    Text("Your story, one period at a time.")
                        .font(.journalBody)
                        .foregroundStyle(Color.textSecondary)
                        .padding(Spacing.m)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .redacted(reason: rows == nil ? .placeholder : [])
                    Divider()
                }
                actions
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
        }
        // `.task` re-runs when Home reappears (e.g. back from the Story screen), so
        // the card picks up summaries written there and new entries' counts. It
        // re-reads entries only when the cache key moved.
        .task { await load() }
    }

    // MARK: - Rows

    private func recapRow(_ row: StoryHomeRow) -> some View {
        NavigationLink(value: StoryRoute(focus: row.key)) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
                    Text(row.label)
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                        .textCase(.uppercase)
                    Spacer(minLength: 0)
                    if row.isStandout {
                        Circle()
                            .fill(Color.accentWarm)
                            .frame(width: 7, height: 7)
                    }
                }
                Text(row.title)
                    .font(.entryTitle)
                    .foregroundStyle(Color.textPrimary)
                Text(row.sentence)
                    .font(.journalBody)
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(2)
            }
            .multilineTextAlignment(.leading)
            .padding(Spacing.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.accessibilityLabel)
        .accessibilityHint("Opens this period in your story")
        .accessibilityAddTraits(.isLink)
    }

    private var actions: some View {
        HStack(spacing: Spacing.m) {
            NavigationLink(value: StoryRoute()) {
                HStack(spacing: Spacing.xs) {
                    Text("Open your story")
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                }
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.m)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens your story, from all time down to single days")

            // STORY MAP INSERTION POINT. The Story Map plan adds, here and nowhere else:
            //   if DevFlags.storyMap {
            //       NavigationLink(value: StoryRoute(mode: .map)) { ... Text("Map") ... }
            //   }
            // This plan ships without it.
        }
    }

    // MARK: - Loading

    private func load() async {
        let timeZone = await services.profileTimeZone()
        let today = PeriodSummaryIndex.localDayIndex(for: Date(), in: timeZone)
        // Four documents by key: this week, last week, last month, last quarter.
        // A failed read keeps what was showing, like a failed entry read below.
        guard let summaries = try? await services.periodSummaries.summaries(for: StoryOutline.homeKeys(today: today))
        else {
            if rows == nil { rows = [] }
            return
        }
        guard !summaries.isEmpty else {
            rows = []
            cacheKey = nil
            return
        }
        // One cheap read decides whether the counts can have changed since last time.
        guard let newest = try? await services.journals.entries(after: nil, limit: 1) else {
            if rows == nil { rows = [] }
            return
        }
        let key = StoryOutline.homeCacheKey(today: today, summaries: summaries, newestEntry: newest.first)
        guard StoryOutline.homeNeedsRecount(cached: cacheKey, current: key) else { return }
        // Counts need entries; see "Where the card's entry counts come from".
        guard let loaded = await StoryOutline.homeEntries(
            since: StoryOutline.homeEntriesStartDay(today: today),
            timeZone: timeZone,
            pageSize: Self.pageSize,
            maxPages: Self.maxPages,
            fetch: { try await services.journals.entries(after: $0, limit: $1) }
        ) else {
            if rows == nil { rows = [] }   // keep what was showing rather than show wrong counts
            return
        }
        rows = StoryOutline.homeRows(summaries: summaries, entries: loaded.entries, today: today,
                                     timeZone: timeZone, countsComplete: loaded.countsComplete)
        cacheKey = key
    }
}
