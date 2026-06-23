import SwiftUI

/// Journal list screen (design §3): type-filterable, date-grouped archive of
/// all entries with infinite scroll. Search is handled by `SearchView`.
struct JournalListView: View {

    @StateObject private var viewModel: JournalListViewModel

    /// Opens the Create flow from a detail-screen prompt card.
    let onPrompt: (CreateEntryRequest) -> Void

    // Retained for the Journal Detail navigation destination.
    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService
    private let media: MediaUploader
    private let onRetryProcessing: ((String) -> Void)?
    private let onStartJournalChat: ((String, String, ChatKind) -> Void)?

    init(
        journals: JournalRepository,
        profiles: ProfileRepository,
        ai: AIService,
        media: MediaUploader,
        onPrompt: @escaping (CreateEntryRequest) -> Void,
        onRetryProcessing: ((String) -> Void)? = nil,
        onStartJournalChat: ((String, String, ChatKind) -> Void)? = nil
    ) {
        _viewModel = StateObject(wrappedValue: JournalListViewModel(journals: journals))
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
        self.media = media
        self.onPrompt = onPrompt
        self.onRetryProcessing = onRetryProcessing
        self.onStartJournalChat = onStartJournalChat
    }

    @State private var isSearchPresented = false
    @State private var isMapPresented = false
    @State private var isInsightsPresented = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spacing.s, pinnedViews: []) {
                    filterChips
                        .padding(.bottom, Spacing.s)

                    content
                }
                .padding(.horizontal, Spacing.m)
                .padding(.bottom, Spacing.xl)
            }
            .background(Color.appBackground.ignoresSafeArea())
            .navigationTitle("Journal")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        isSearchPresented = true
                    } label: {
                        Image(systemName: "magnifyingglass")
                    }
                    .accessibilityLabel("Search journal")
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        isMapPresented = true
                    } label: {
                        Image(systemName: "circle.hexagongrid")
                    }
                    .accessibilityLabel("Open journal map")
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        isInsightsPresented = true
                    } label: {
                        Image(systemName: "chart.bar.xaxis")
                    }
                    .accessibilityLabel("Journal insights")
                }
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
            .fullScreenCover(isPresented: $isSearchPresented) {
                SearchView(
                    ai: ai,
                    journals: journals,
                    profiles: profiles,
                    media: media,
                    onPrompt: onPrompt,
                    onRetryProcessing: onRetryProcessing
                )
            }
            .fullScreenCover(isPresented: $isMapPresented) {
                JournalConstellationView(
                    journals: journals,
                    profiles: profiles,
                    ai: ai,
                    media: media,
                    onPrompt: onPrompt,
                    onRetryProcessing: onRetryProcessing
                )
            }
            .fullScreenCover(isPresented: $isInsightsPresented) {
                InsightsView(journals: journals)
            }
        }
        .task {
            await viewModel.start()
        }
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoadingFirstPage {
            skeletonRows
        } else if viewModel.loadFailed && viewModel.entries.isEmpty {
            EmptyStateView(
                systemImage: "wifi.exclamationmark",
                title: "Couldn't load your journal",
                message: "Something went wrong loading your entries. Check your connection and try again.",
                actionTitle: "Retry",
                action: { Task { await viewModel.retryFirstPage() } }
            )
        } else if viewModel.entries.isEmpty {
            EmptyStateView(
                systemImage: "book.closed",
                title: "No entries yet",
                message: "Your journal is waiting for its first page. Capture a thought, a moment, or a voice note."
            )
        } else if viewModel.isFilteredEmpty {
            EmptyStateView(
                systemImage: "line.3.horizontal.decrease.circle",
                title: "No matches",
                message: "Nothing in your journal matches this filter."
            )
        } else {
            entrySections
            if viewModel.isLoadingNextPage {
                paginationFooter
            }
        }
    }

    private var skeletonRows: some View {
        ForEach(0..<5, id: \.self) { _ in
            EntryRow(entry: .skeletonPlaceholder, showsTime: true)
                .redacted(reason: .placeholder)
        }
        .accessibilityHidden(true)
    }

    private var entrySections: some View {
        ForEach(viewModel.sections) { section in
            SectionHeader(title: section.title)
                .padding(.top, Spacing.s)

            ForEach(section.entries) { entry in
                NavigationLink(value: JournalDetailRoute(entryId: entry.id)) {
                    EntryRow(entry: entry, showsTime: true, media: media)
                }
                .buttonStyle(.plain)
                .onAppear {
                    Task { await viewModel.loadNextPageIfNeeded(after: entry) }
                }
            }
        }
    }

    /// Bottom loading indicator while the next page is fetched.
    private var paginationFooter: some View {
        HStack {
            Spacer()
            ProgressView()
                .tint(Color.accentWarm)
            Spacer()
        }
        .padding(.vertical, Spacing.m)
    }

    // MARK: - Filter chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s) {
                ForEach(JournalListViewModel.TypeFilter.allFilters, id: \.self) { filter in
                    FilterChip(
                        filter: filter,
                        isSelected: viewModel.filter == filter,
                        action: { viewModel.filter = filter }
                    )
                }
            }
            .padding(.vertical, Spacing.xs)
        }
        .scrollClipDisabled()
    }
}

// MARK: - Filter chip

/// Capsule chip for the type filter row; uses the entry-type tint.
private struct FilterChip: View {

    let filter: JournalListViewModel.TypeFilter
    let isSelected: Bool
    let action: () -> Void

    private var tint: Color {
        switch filter {
        case .all: return .accentWarm
        case .type(let type): return type.tint
        }
    }

    var body: some View {
        Button(action: action) {
            Text(filter.title)
                .font(.captionText.weight(.semibold))
                .foregroundStyle(isSelected ? Color.white : tint)
                .padding(.horizontal, Spacing.m)
                .frame(minHeight: 32)
                .background(
                    Capsule().fill(isSelected ? tint : tint.opacity(0.15))
                )
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Filter: \(filter.title)")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

// MARK: - Previews

#Preview("Light") {
    JournalListPreview()
}

#Preview("Dark") {
    JournalListPreview()
        .preferredColorScheme(.dark)
}

#Preview("Empty") {
    JournalListPreview(entries: [])
}

private struct JournalListPreview: View {
    var entries: [JournalEntry] = MockData.journalEntries

    var body: some View {
        JournalListView(
            journals: MockJournalRepository(entries: entries),
            profiles: MockProfileRepository(),
            ai: MockAIService(),
            media: MockMediaUploader(),
            onPrompt: { _ in }
        )
    }
}
