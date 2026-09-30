import SwiftUI

/// The Story screen's Map view: the Cognitive Map pyramid over the whole journal,
/// pinch-zoomable from all time down to one entry's beats, captioned from the
/// period summaries store. Embedded in `StoryView`, so it has no navigation stack
/// or Close button of its own. Spec: docs/superpowers/specs/2026-09-28-story-map-design.md.
struct StoryMapView: View {

    @EnvironmentObject private var services: AppServices
    /// Opens the map on this period (from the Story view); nil opens the week tier.
    let focus: PeriodKey?
    /// The focused dot's summary key, so switching to Story opens that period.
    let onFocusChange: (PeriodKey) -> Void
    let onSeeInStory: (PeriodKey) -> Void

    @State private var controller = StoryMapController()
    @State private var data: StoryMapData?
    @State private var focusInfo: FocusInfo?
    @State private var tierIsEmpty = false
    @State private var readMore = false
    @State private var selectedEntryByDay: [Int: String] = [:]
    @State private var selectedBeat: Beat?
    @State private var selectedBeatEntryContent = ""

    var body: some View {
        VStack(spacing: 0) {
            StoryMapWebView(
                journals: services.journals,
                ai: services.ai,
                controller: controller,
                initialFocus: focus.map(StoryMapKeys.pyramidTarget(for:)),
                onFocusChange: { info in
                    focusInfo = info
                    readMore = false
                    if let info, let key = StoryMapKeys.summaryKey(periodType: info.periodType, periodIndex: info.periodIndex) {
                        onFocusChange(key)
                    }
                },
                onTierLoaded: { _, isEmpty in tierIsEmpty = isEmpty },
                onSelectBeat: { beat, content in
                    selectedBeatEntryContent = content
                    selectedBeat = beat
                }
            )
            captionBar
        }
        .background(Color.appBackground.ignoresSafeArea())
        .task { await load() }
        .sheet(item: $selectedBeat) { beat in
            BeatInspectorSheet(beat: beat, entryContent: selectedBeatEntryContent)
        }
    }

    // MARK: - Loading

    /// Entries, summaries and the timezone once; then the same read-refresh the Story
    /// view runs (budget 6, open periods included), reloading summaries if it wrote any.
    private func load() async {
        let timeZone = await services.profileTimeZone()
        let entries = (try? await services.journals.fetchAllEntries()) ?? []
        await applySummaries(entries: entries, timeZone: timeZone)
        guard services.consentStore.hasConsentedAI else { return }
        let generated = await services.periodSummaryReconciler?.run(budget: 6, includeOpen: true).generated ?? 0
        if generated > 0 { await applySummaries(entries: entries, timeZone: timeZone) }
    }

    private func applySummaries(entries: [JournalEntry], timeZone: TimeZone) async {
        // A failed read still renders the map; every caption says "Not summarized yet".
        let summaries = (try? await services.periodSummaries.all()) ?? []
        let next = StoryMapData(entries: entries, summaries: summaries, timeZone: timeZone)
        data = next
        controller.update(next)
    }

    // MARK: - Caption

    private var caption: StoryMapCaption? {
        guard let info = focusInfo, let data,
              let key = StoryMapKeys.summaryKey(periodType: info.periodType, periodIndex: info.periodIndex)
        else { return nil }
        let today = PeriodSummaryIndex.localDayIndex(for: Date(), in: data.timeZone)
        let childCount = key.type == .day ? dayEntries(key.index).count : info.childCount
        return StoryMapCaption.make(summary: data.summaries[key], key: key, childCount: childCount,
                                    entriesById: data.entriesById, today: today, timeZone: data.timeZone)
    }

    private func dayEntries(_ day: Int) -> [JournalEntry] {
        guard let data else { return [] }
        return StoryMapDay.entries(onDay: day, from: data.entries, timeZone: data.timeZone)
    }

    @ViewBuilder
    private var captionBar: some View {
        if let caption {
            Group {
                if readMore {
                    ScrollView { captionContent(caption) }
                        .frame(maxHeight: 320)
                } else {
                    captionContent(caption)
                }
            }
            .background(Color.cardBackground)
            .transition(.opacity)
        } else if tierIsEmpty {
            Text("No map for this zoom level yet.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
                .padding(Spacing.m)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.cardBackground)
        }
    }

    private func captionContent(_ caption: StoryMapCaption) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(caption.labelLine)
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.textSecondary)
                .textCase(.uppercase)
            HStack(alignment: .firstTextBaseline, spacing: Spacing.xs) {
                if caption.isStandout {
                    Circle()
                        .fill(Color.accentWarm)
                        .frame(width: 7, height: 7)
                        .accessibilityHidden(true)
                }
                Text(caption.title ?? "Not summarized yet")
                    .font(.entryTitle)
                    .foregroundStyle(caption.title == nil ? Color.textSecondary : Color.textPrimary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel((caption.title ?? "Not summarized yet") + (caption.isStandout ? ", a standout period" : ""))
            if let sentence = caption.sentence {
                Text(sentence)
                    .font(.journalBody)
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(readMore ? nil : 2)
            }
            if caption.key.type == .day {
                dayChips(caption.key.index)
            }
            if readMore {
                grounding(caption)
            }
            HStack {
                if caption.summary != nil {
                    Button(readMore ? "Show less" : "Read more") {
                        withAnimation(.easeInOut(duration: 0.2)) { readMore.toggle() }
                    }
                }
                Spacer()
                Button("See in Story") { onSeeInStory(caption.key) }
            }
            .font(.uiBody.weight(.semibold))
            .foregroundStyle(Color.accentWarm)
            .padding(.top, Spacing.xs)
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The ~100-word summary, then one quote and the high point, each opening its
    /// entry. The accordion shows the full set; the caption bar is small.
    @ViewBuilder
    private func grounding(_ caption: StoryMapCaption) -> some View {
        if let summary = caption.summary {
            Text(summary)
                .font(.journalBody)
                .foregroundStyle(Color.textPrimary)
                .padding(.top, Spacing.xs)
        }
        if let quote = caption.quote {
            NavigationLink(value: StoryEntryRoute(entryId: quote.entryId)) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("\u{201C}\(quote.quote)\u{201D}")
                        .font(.journalBody.italic())
                        .foregroundStyle(Color.textPrimary)
                        .multilineTextAlignment(.leading)
                    Text(quote.attribution)
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                .padding(.leading, Spacing.s)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color.accentWarm.opacity(0.5)).frame(width: 2)
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the entry")
        }
        if let high = caption.highPoint {
            NavigationLink(value: StoryEntryRoute(entryId: high.entryId)) {
                HStack(spacing: Spacing.s) {
                    Text("High point")
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                        .textCase(.uppercase)
                    Text(high.title)
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)
                    Spacer(minLength: Spacing.s)
                    Text(high.attribution)
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("High point: \(high.title), \(high.attribution)")
            .accessibilityHint("Opens the entry")
        }
    }

    /// One chip per entry when a day holds more than one; the newest is selected.
    @ViewBuilder
    private func dayChips(_ day: Int) -> some View {
        let entries = dayEntries(day)
        if entries.count > 1, let data {
            let selected = selectedEntryByDay[day] ?? entries.first?.id
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.xs) {
                    ForEach(StoryMapDay.chips(entries, timeZone: data.timeZone)) { chip in
                        Button {
                            selectedEntryByDay[day] = chip.id
                            controller.showEntry(day: day, id: chip.id)
                        } label: {
                            Text(chip.label)
                                .font(.captionText.weight(.semibold))
                                .lineLimit(1)
                                .padding(.horizontal, Spacing.s)
                                .padding(.vertical, Spacing.xs)
                                .foregroundStyle(chip.id == selected ? Color.appBackground : Color.textPrimary)
                                .background(
                                    Capsule().fill(chip.id == selected ? Color.accentWarm : Color.accentWarm.opacity(0.12))
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(chip.id == selected ? .isSelected : [])
                        .accessibilityHint("Shows this entry's map")
                    }
                }
            }
            .padding(.vertical, Spacing.xs)
        }
    }
}
