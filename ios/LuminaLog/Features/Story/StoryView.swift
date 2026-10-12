import SwiftUI

/// Which view the Story screen shows: the outline, or the Story Map (behind `DevFlags.storyMap`).
enum StoryMode: Hashable, Sendable {
    case story, map
}

/// Pushes the Story screen (from Home's or Settings' navigation stack). `focus`
/// nil is the default "zoomed to now" state; a key opens the outline on that period.
struct StoryRoute: Hashable {
    var mode: StoryMode = .story
    var focus: PeriodKey? = nil
}

/// An entry opened from the outline. Its own route type, not `JournalDetailRoute`,
/// so this screen can declare its destination without clashing with Home's.
struct StoryEntryRoute: Hashable {
    let entryId: String
}

/// The Story screen: the whole journal as an outline of period summaries, or (with
/// `DevFlags.storyMap`) as the zoomable Story Map, behind a `Story | Map` segment.
/// Specs: docs/superpowers/specs/2026-09-28-story-accordion-design.md and
/// docs/superpowers/specs/2026-09-28-story-map-design.md.
/// Reads `AppServices` from the environment, so both entry points build it the same way.
struct StoryView: View {

    @EnvironmentObject private var services: AppServices
    @State private var mode: StoryMode
    /// The period both views share: the last row expanded in the outline, or the
    /// last dot focused on the Map. Switching views opens the other one on it.
    @State private var focusedPeriod: PeriodKey?
    /// Opens the Create flow (empty state, and prompt cards inside entry detail).
    let onPrompt: (CreateEntryRequest) -> Void

    /// Explicit because the private environment object would make the memberwise
    /// initializer private, and callers need the defaults.
    init(mode: StoryMode = .story, focus: PeriodKey? = nil, onPrompt: @escaping (CreateEntryRequest) -> Void) {
        // With the flag off there is no Map; a `.map` route shows the outline.
        _mode = State(initialValue: DevFlags.storyMap ? mode : .story)
        _focusedPeriod = State(initialValue: focus)
        self.onPrompt = onPrompt
    }

    var body: some View {
        Group {
            switch mode {
            case .story:
                StoryScreen(services: services, focus: focusedPeriod, onPrompt: onPrompt,
                            onExpand: { focusedPeriod = $0 })
            case .map:
                StoryMapView(
                    focus: focusedPeriod,
                    onFocusChange: { focusedPeriod = $0 },
                    onSeeInStory: { key in
                        focusedPeriod = key
                        mode = .story
                    }
                )
            }
        }
        .navigationTitle("Your story")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if DevFlags.storyMap {
                ToolbarItem(placement: .principal) {
                    Picker("View", selection: $mode) {
                        Text("Story").tag(StoryMode.story)
                        Text("Map").tag(StoryMode.map)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 180)
                }
            }
        }
        // Here, not in StoryScreen, so the Map's quote and high-point links resolve too.
        .navigationDestination(for: StoryEntryRoute.self) { route in
            JournalDetailView(
                entryId: route.entryId,
                journals: services.journals,
                profiles: services.profiles,
                ai: services.ai,
                media: services.media,
                onPrompt: onPrompt
            )
            .tracksInterruptionSurface(services.activity)
        }
    }
}

/// Split from `StoryView` because a `@StateObject` needs its dependencies at init,
/// and an environment object isn't readable there.
private struct StoryScreen: View {

    @StateObject private var viewModel: StoryViewModel
    private let services: AppServices
    private let onPrompt: (CreateEntryRequest) -> Void
    /// Tells `StoryView` which period the user just opened, for the Map switch.
    private let onExpand: (PeriodKey) -> Void

    init(services: AppServices, focus: PeriodKey?, onPrompt: @escaping (CreateEntryRequest) -> Void,
         onExpand: @escaping (PeriodKey) -> Void = { _ in }) {
        self.services = services
        self.onPrompt = onPrompt
        self.onExpand = onExpand
        _viewModel = StateObject(wrappedValue: StoryViewModel(
            loadEntries: { try await services.journals.fetchAllEntries() },
            loadSummaries: { try await services.periodSummaries.all() },
            timeZone: { await services.profileTimeZone() },
            // Generous: while the reader is on this screen the backfill keeps going,
            // and each batch redraws the outline as it lands.
            reconcile: { await services.periodSummaryReconciler?.run(budget: 40, includeOpen: true).generated ?? 0 },
            hasConsent: { services.consentStore.hasConsentedAI },
            focus: focus
        ))
    }

    /// The row at the top of the screen, which the running head names.
    @State private var topRowId: String?

    var body: some View {
        ScrollViewReader { proxy in
          VStack(spacing: 0) {
            runningHead(proxy)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    content
                }
                .scrollTargetLayout()
                .padding(.horizontal, 14)
                .padding(.top, Spacing.xs)
                .padding(.bottom, AppTabBar.scrollBottomPadding)
            }
            .scrollPosition(id: $topRowId, anchor: .top)
          }
            // The view model sets `scrollTarget` once, on the first build of a
            // focused screen, so this scrolls exactly once after the first load.
            .onChange(of: viewModel.scrollTarget) { _, target in
                guard let target else { return }
                withAnimation(.easeInOut(duration: 0.25)) { proxy.scrollTo(target, anchor: .top) }
            }
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Your story")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            await viewModel.load()
            await viewModel.reconcileAndReload()
        }
        .task { await viewModel.start() }
        .onReceive(NotificationCenter.default.publisher(for: .periodSummariesDidChange)) { _ in
            Task { await viewModel.summariesChanged() }
        }
    }

    /// The running head, as at the top of a printed page: the open sections that hold
    /// the row at the top of the screen. Tapping one scrolls back to its heading.
    @ViewBuilder
    private func runningHead(_ proxy: ScrollViewProxy) -> some View {
        let top = viewModel.rows.contains { $0.id == topRowId } ? topRowId : viewModel.rows.first?.id
        let trail = StoryOutline.trail(viewModel.rows, topId: top, expanded: viewModel.expanded)
        if viewModel.state == .loaded, !trail.isEmpty {
            VStack(spacing: 0) {
                // Outer levels give way first, so the innermost section always reads.
                HStack(spacing: 4) {
                    ForEach(Array(trail.enumerated()), id: \.element.id) { index, row in
                        if index > 0 {
                            Text("\u{00B7}").foregroundStyle(Color.textSecondary).accessibilityHidden(true)
                        }
                        Button {
                            withAnimation(.easeInOut(duration: 0.25)) { proxy.scrollTo(row.id, anchor: .top) }
                        } label: {
                            Text(StoryOutline.shortLabel(row.node))
                                .lineLimit(1)
                                .foregroundStyle(index == trail.count - 1 ? Color.accentWarm : Color.textSecondary)
                        }
                        .buttonStyle(.plain)
                        .layoutPriority(Double(index))
                        .accessibilityHint("Scrolls to this section")
                    }
                    Spacer(minLength: 0)
                }
                .font(.system(.footnote, design: .serif).smallCaps())
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                Rectangle().fill(Color.textSecondary.opacity(0.35)).frame(height: 0.5)
            }
            .background(Color.appBackground)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("You are in")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ForEach(0..<6, id: \.self) { _ in
                Text("Loading the outline of your story")
                    .font(.system(.subheadline, design: .serif))
                    .padding(.vertical, 6)
            }
            .redacted(reason: .placeholder)
            .accessibilityHidden(true)
        case .empty:
            EmptyStateView(
                systemImage: "book.closed",
                title: "Your story starts with your first entry.",
                message: "Write a few entries and Argo will start summarizing your days, weeks and months here.",
                actionTitle: "Write",
                action: { onPrompt(CreateEntryRequest()) }
            )
        case .failed:
            VStack(spacing: Spacing.m) {
                Text("Couldn't load your story.")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                Button("Try again") { Task { await viewModel.load() } }
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
            }
            .frame(maxWidth: .infinity)
            .padding(Spacing.l)
        case .loaded:
            if let message = bannerMessage {
                Text(message)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                    .italic()
                    .padding(.vertical, Spacing.s)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            ForEach(viewModel.rows) { row in
                StoryRowView(
                    row: row,
                    isExpanded: viewModel.expanded.contains(row.id),
                    onToggle: {
                        if !viewModel.expanded.contains(row.id), let key = row.node.key { onExpand(key) }
                        withAnimation(.easeInOut(duration: 0.2)) { viewModel.toggle(row.id) }
                    }
                )
                .id(row.id)   // scroll target for a focused open
            }
        }
    }

    private var bannerMessage: String? {
        if viewModel.consentOff { return "Summaries use Argo AI. Turn it on in Settings." }
        if viewModel.awaitingSummaries { return "Argo is writing your story. New summaries appear each time you open the app." }
        return nil
    }
}
