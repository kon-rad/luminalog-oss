import SwiftUI

/// Home screen (design §2): wordmark + greeting, daily prompt hero,
/// streak/word stat cards, and the latest 10 entries.
struct HomeView: View {

    @StateObject private var viewModel: HomeViewModel
    @StateObject private var soulViewModel: SoulViewModel
    @State private var showSoulFullScreen = false
    /// True while a finger is on the galaxy panel — disables the outer ScrollView
    /// so dragging orbits the galaxy instead of scrolling the page.
    @State private var galaxyTouched = false

    /// Opens the Create flow, optionally seeded with a prompt.
    let onStartJournaling: (String?) -> Void
    /// Switches the shell to the Journal tab ("Show more").
    let onShowMore: () -> Void
    /// Opens the Create flow from a detail-screen prompt card.
    let onPrompt: (CreateEntryRequest) -> Void

    // Retained for the Journal Detail navigation destination.
    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService
    private let soul: SoulService
    private let media: MediaUploader
    private let dailyReports: DailyReportRepository
    private let failedReports: FailedReportStore
    private let onRetryProcessing: ((String) -> Void)?
    private let onStartJournalChat: ((String, String, ChatKind) -> Void)?
    private let activity: AppActivityMonitor
    /// Reopens a draft in the Create flow.
    let onResumeDraft: (String) -> Void

    init(
        journals: JournalRepository,
        profiles: ProfileRepository,
        ai: AIService,
        soul: SoulService,
        media: MediaUploader,
        dailyReports: DailyReportRepository,
        failedReports: FailedReportStore,
        activity: AppActivityMonitor,
        drafts: DraftStore,
        onStartJournaling: @escaping (String?) -> Void,
        onShowMore: @escaping () -> Void,
        onPrompt: @escaping (CreateEntryRequest) -> Void,
        onResumeDraft: @escaping (String) -> Void,
        onRetryProcessing: ((String) -> Void)? = nil,
        onStartJournalChat: ((String, String, ChatKind) -> Void)? = nil
    ) {
        self.activity = activity
        _viewModel = StateObject(
            wrappedValue: HomeViewModel(journals: journals, profiles: profiles, ai: ai, dailyReports: dailyReports, activity: activity, drafts: drafts)
        )
        _soulViewModel = StateObject(wrappedValue: SoulViewModel(service: soul))
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
        self.soul = soul
        self.media = media
        self.dailyReports = dailyReports
        self.failedReports = failedReports
        self.onStartJournaling = onStartJournaling
        self.onShowMore = onShowMore
        self.onPrompt = onPrompt
        self.onResumeDraft = onResumeDraft
        self.onRetryProcessing = onRetryProcessing
        self.onStartJournalChat = onStartJournalChat
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    header
                    soulSection
                    promptCard
                    statsRow
                    reflectionsScroll
                    recentSection
                }
                .padding(.horizontal, Spacing.m)
                .padding(.top, Spacing.m)
                .padding(.bottom, AppTabBar.scrollBottomPadding)
            }
            .scrollDisabled(galaxyTouched)
            .background(Color.appBackground.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $viewModel.showMilestone, onDismiss: {
                if viewModel.pendingShowReport {
                    viewModel.pendingShowReport = false
                    viewModel.showReport = true
                }
            }) {
                MilestonePopupView(
                    target: viewModel.goalTarget,
                    earnedToday: viewModel.milestoneEarnedToday,
                    onGenerate: {
                        viewModel.pendingShowReport = true
                        viewModel.showMilestone = false
                    },
                    onDismiss: { viewModel.showMilestone = false }
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
            .fullScreenCover(isPresented: $viewModel.showReport) {
                DailyInsightsReportView(ai: ai, reports: dailyReports, date: nil, failedReports: failedReports)
                    .tracksInterruptionSurface(activity)
            }
            .navigationDestination(for: JournalDetailRoute.self) { route in
                JournalDetailView(
                    entryId: route.entryId,
                    journals: journals,
                    profiles: profiles,
                    ai: ai,
                    media: media,
                    onPrompt: onPrompt,
                    onRetryProcessing: onRetryProcessing,
                    onStartJournalChat: onStartJournalChat
                )
                .tracksInterruptionSurface(activity)
            }
        }
        .task {
            viewModel.start()
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("LuminaLog")
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
                .textCase(.uppercase)
                .kerning(1.2)

            Text(viewModel.greeting)
                .font(.journalTitle)
                .foregroundStyle(Color.textPrimary)
        }
        .padding(.top, Spacing.s)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Soul constellation (hero)

    private var soulSection: some View {
        VStack(spacing: Spacing.m) {
            SoulGalaxyPanel(viewModel: soulViewModel)
                // Touch-down on the galaxy disables the outer scroll so the drag
                // orbits the 3D view; releasing re-enables page scrolling.
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in if !galaxyTouched { galaxyTouched = true } }
                        .onEnded { _ in galaxyTouched = false }
                )
            soulControlsRow
            HStack(spacing: Spacing.m) {
                StatCard(value: "\(soulViewModel.stars)", label: "stars", systemImage: "sparkles")
                StatCard(value: (soulViewModel.payload?.stats.streakCount ?? 0).formatted(),
                         label: "day streak", systemImage: "flame")
                StatCard(value: (soulViewModel.payload?.stats.totalWords ?? 0).formatted(),
                         label: "total words")
            }
        }
        .fullScreenCover(isPresented: $showSoulFullScreen) {
            SoulFullScreenView(points: soulViewModel.payload?.constellation.points ?? []) {
                showSoulFullScreen = false
            }
        }
        .task { await soulViewModel.load() }
    }

    /// Below the galaxy: wallet address + BaseScan NFT link (left), full-screen
    /// button (right). Shown only once the soul is minted.
    private var soulControlsRow: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            // Full wallet address on its own line — fully visible (scales down on
            // narrow devices rather than truncating), long-press to copy.
            if let wallet = soulViewModel.payload?.nft?.walletAddress {
                Text(wallet)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .textSelection(.enabled)
            }
            HStack(alignment: .center, spacing: Spacing.m) {
                if let url = soulViewModel.payload?.nft?.explorerURL {
                    Link(destination: url) {
                        HStack(spacing: 3) {
                            Text("View NFT on BaseScan")
                            Image(systemName: "arrow.up.right")
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.accentWarm)
                    }
                }
                Spacer(minLength: 0)
                Button {
                    showSoulFullScreen = true
                } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.textPrimary)
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.cardBackground))
                }
                .accessibilityLabel("Open full-screen galaxy")
            }
        }
    }

    // MARK: - Daily prompt hero

    @ViewBuilder
    private var promptCard: some View {
        switch viewModel.promptState {
        case .loading:
            promptLoadingCard
        case .loaded(let prompts):
            DailyPromptCarousel(
                prompts: prompts,
                onStart: { onStartJournaling($0.text) }
            )
        }
    }

    /// Placeholder treatment while today's prompt is generated.
    private var promptLoadingCard: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            HStack(spacing: Spacing.s) {
                ProgressView()
                    .tint(Color.accentWarm)
                Text("Preparing today's prompt…")
                    .font(.promptQuoteCompact)
                    .foregroundStyle(Color.textSecondary)
            }
            .frame(minHeight: 60, alignment: .leading)
        }
        .padding(Spacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.xLarge, style: .continuous)
                .fill(Color.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.xLarge, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.accentWarm.opacity(0.20),
                                    Color.accentWarm.opacity(0.04),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
        )
        .accessibilityLabel("Preparing today's prompt")
    }

    // MARK: - Daily Reflections carousel

    private var reflectionsScroll: some View {
        DailyReflectionsScrollView(
            repository: dailyReports,
            ai: ai,
            today: viewModel.todayKeyPublic,
            goalMet: viewModel.goalMet,
            failedReports: failedReports,
            onTapToday: { viewModel.showReport = true }
        )
    }

    // MARK: - Stats

    @ViewBuilder
    private var statsRow: some View {
        VStack(spacing: Spacing.m) {
            GoalProgressCard(
                current: viewModel.goalProgressWords,
                target: viewModel.goalTarget,
                fraction: viewModel.goalFraction,
                label: viewModel.goalProgressLabel,
                isMet: viewModel.goalMet
            )
            HStack(spacing: Spacing.m) {
                StatCard(
                    value: viewModel.streakText,
                    label: "streak",
                    systemImage: "flame.fill"
                )
                StatCard(
                    value: viewModel.totalWordsText,
                    label: "words in your journal"
                )
            }
        }
        .redacted(reason: viewModel.profile == nil ? .placeholder : [])
    }

    // MARK: - Recent entries

    @ViewBuilder
    private var recentSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            SectionHeader(title: "Recent entries")

            switch viewModel.recentEntries {
            case nil:
                skeletonRows
            case .some(let entries) where entries.isEmpty && viewModel.listItems?.isEmpty != false:
                EmptyStateView(
                    systemImage: "book.closed",
                    title: "No entries yet",
                    message: "Your journal is waiting for its first page. Capture a thought, a moment, or a voice note.",
                    actionTitle: "Write your first entry",
                    action: { onStartJournaling(viewModel.currentPromptText) }
                )
            case .some:
                ForEach(viewModel.listItems ?? []) { item in
                    switch item {
                    case .entry(let entry):
                        NavigationLink(value: JournalDetailRoute(entryId: entry.id)) {
                            EntryRow(entry: entry, showsTime: false, media: media)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            if entry.processingStatus == .failed, let onRetryProcessing {
                                Button {
                                    onRetryProcessing(entry.id)
                                } label: {
                                    Label("Retry", systemImage: "arrow.clockwise")
                                }
                            }
                        }
                    case .draft(let draft):
                        Button { onResumeDraft(draft.draftId) } label: {
                            DraftRow(draft: draft)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(role: .destructive) {
                                viewModel.discardDraft(draft.draftId)
                            } label: {
                                Label("Discard", systemImage: "trash")
                            }
                        }
                    }
                }
                showMoreRow
            }
        }
    }

    /// Redacted EntryRow placeholders while the first emission is in flight.
    private var skeletonRows: some View {
        ForEach(0..<3, id: \.self) { _ in
            EntryRow(entry: .skeletonPlaceholder)
                .redacted(reason: .placeholder)
        }
        .accessibilityHidden(true)
    }

    private var showMoreRow: some View {
        Button(action: onShowMore) {
            HStack {
                Text("Show more")
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.accentWarm)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Show more entries")
        .accessibilityHint("Opens the Journal tab")
    }
}

// MARK: - Previews

#Preview("Light") {
    HomePreview()
}

#Preview("Dark") {
    HomePreview()
        .preferredColorScheme(.dark)
}

private struct HomePreview: View {
    var body: some View {
        HomeView(
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(),
            ai: MockAIService(),
            soul: MockSoulService(),
            media: MockMediaUploader(),
            dailyReports: MockDailyReportRepository(),
            failedReports: FailedReportStore(auth: MockAuthService(signedIn: true), directory: FileManager.default.temporaryDirectory),
            activity: AppActivityMonitor(),
            drafts: DraftStore(directory: FileManager.default.temporaryDirectory.appendingPathComponent("PreviewDrafts")),
            onStartJournaling: { _ in },
            onShowMore: {},
            onPrompt: { _ in },
            onResumeDraft: { _ in }
        )
    }
}
