import SwiftUI

/// Home screen (design §2): wordmark + greeting, daily prompt hero,
/// streak/word stat cards, and the latest 10 entries.
struct HomeView: View {

    @StateObject private var viewModel: HomeViewModel

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
    private let media: MediaUploader
    private let dailyReports: DailyReportRepository
    private let onRetryProcessing: ((String) -> Void)?
    private let onStartJournalChat: ((String, String, ChatKind) -> Void)?

    init(
        journals: JournalRepository,
        profiles: ProfileRepository,
        ai: AIService,
        media: MediaUploader,
        dailyReports: DailyReportRepository,
        onStartJournaling: @escaping (String?) -> Void,
        onShowMore: @escaping () -> Void,
        onPrompt: @escaping (CreateEntryRequest) -> Void,
        onRetryProcessing: ((String) -> Void)? = nil,
        onStartJournalChat: ((String, String, ChatKind) -> Void)? = nil
    ) {
        _viewModel = StateObject(
            wrappedValue: HomeViewModel(journals: journals, profiles: profiles, ai: ai, dailyReports: dailyReports)
        )
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
        self.media = media
        self.dailyReports = dailyReports
        self.onStartJournaling = onStartJournaling
        self.onShowMore = onShowMore
        self.onPrompt = onPrompt
        self.onRetryProcessing = onRetryProcessing
        self.onStartJournalChat = onStartJournalChat
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    header
                    promptCard
                    statsRow
                    insightsCardEntry
                    reflectionsScroll
                    recentSection
                }
                .padding(.horizontal, Spacing.m)
                .padding(.top, Spacing.m)
                .padding(.bottom, Spacing.xl)
            }
            .background(Color.appBackground.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .overlay { if viewModel.showMilestone { milestoneOverlay } }
            .sheet(isPresented: $viewModel.showReport) {
                DailyInsightsReportView(ai: ai, reports: dailyReports, date: nil)
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

    // MARK: - Milestone popup + insights card

    private var milestoneOverlay: some View {
        ZStack {
            Color.black.opacity(0.45).ignoresSafeArea()
                .onTapGesture { viewModel.showMilestone = false }
            VStack { Spacer()
                MilestonePopupView(
                    target: viewModel.goalTarget,
                    onGenerate: { viewModel.showMilestone = false; viewModel.showReport = true },
                    onDismiss: { viewModel.showMilestone = false }
                )
            }
        }
        .transition(.opacity)
    }

    @ViewBuilder private var insightsCardEntry: some View {
        if viewModel.todaysReport != nil {
            Button { viewModel.showReport = true } label: {
                HStack(spacing: Spacing.s) {
                    Image(systemName: "sparkles").foregroundStyle(Color.accentWarm)
                    Text("Today's insights").font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.accentWarm)
                }
                .padding(Spacing.m)
                .background(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Daily Reflections carousel

    private var reflectionsScroll: some View {
        DailyReflectionsScrollView(
            repository: dailyReports,
            ai: ai,
            today: viewModel.todayKeyPublic
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
            case .some(let entries) where entries.isEmpty:
                EmptyStateView(
                    systemImage: "book.closed",
                    title: "No entries yet",
                    message: "Your journal is waiting for its first page. Capture a thought, a moment, or a voice note.",
                    actionTitle: "Write your first entry",
                    action: { onStartJournaling(viewModel.currentPromptText) }
                )
            case .some(let entries):
                ForEach(entries) { entry in
                    NavigationLink(value: JournalDetailRoute(entryId: entry.id)) {
                        EntryRow(entry: entry, showsTime: false, media: media)
                    }
                    .buttonStyle(.plain)
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
            media: MockMediaUploader(),
            dailyReports: MockDailyReportRepository(),
            onStartJournaling: { _ in },
            onShowMore: {},
            onPrompt: { _ in }
        )
    }
}
