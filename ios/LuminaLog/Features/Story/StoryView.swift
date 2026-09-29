import SwiftUI

/// Which view the Story screen shows. The Story Map plan adds the `Story | Map`
/// segment and the Map view; until then `.map` shows the outline.
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

/// The Story screen: the whole journal as an outline of period summaries.
/// Spec: docs/superpowers/specs/2026-09-28-story-accordion-design.md.
/// Reads `AppServices` from the environment, so both entry points build it the same way.
struct StoryView: View {

    @EnvironmentObject private var services: AppServices
    let mode: StoryMode
    let focus: PeriodKey?
    /// Opens the Create flow (empty state, and prompt cards inside entry detail).
    let onPrompt: (CreateEntryRequest) -> Void

    /// Explicit because the private environment object would make the memberwise
    /// initializer private, and callers need the defaults.
    init(mode: StoryMode = .story, focus: PeriodKey? = nil, onPrompt: @escaping (CreateEntryRequest) -> Void) {
        self.mode = mode
        self.focus = focus
        self.onPrompt = onPrompt
    }

    var body: some View {
        // Both modes show the outline in this plan; the Story Map plan switches on `mode`.
        StoryScreen(services: services, focus: focus, onPrompt: onPrompt)
    }
}

/// Split from `StoryView` because a `@StateObject` needs its dependencies at init,
/// and an environment object isn't readable there.
private struct StoryScreen: View {

    @StateObject private var viewModel: StoryViewModel
    private let services: AppServices
    private let onPrompt: (CreateEntryRequest) -> Void

    init(services: AppServices, focus: PeriodKey?, onPrompt: @escaping (CreateEntryRequest) -> Void) {
        self.services = services
        self.onPrompt = onPrompt
        _viewModel = StateObject(wrappedValue: StoryViewModel(
            loadEntries: { try await services.journals.fetchAllEntries() },
            loadSummaries: { try await services.periodSummaries.all() },
            timeZone: { await services.profileTimeZone() },
            reconcile: { await services.periodSummaryReconciler?.run(budget: 6, includeOpen: true).generated ?? 0 },
            hasConsent: { services.consentStore.hasConsentedAI },
            focus: focus
        ))
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spacing.s) {
                    content
                }
                .padding(.horizontal, Spacing.m)
                .padding(.top, Spacing.s)
                .padding(.bottom, AppTabBar.scrollBottomPadding)
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

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
                    .frame(height: 96)
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
                    .padding(Spacing.m)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                            .fill(Color.accentWarm.opacity(0.08))
                    )
            }
            ForEach(viewModel.rows) { row in
                StoryRowView(
                    row: row,
                    isExpanded: viewModel.expanded.contains(row.id),
                    onToggle: { withAnimation(.easeInOut(duration: 0.2)) { viewModel.toggle(row.id) } }
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
