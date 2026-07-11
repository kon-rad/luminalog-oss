import SwiftUI

/// Full-screen search overlay — keyword and semantic modes.
/// Presented via `.fullScreenCover` from `JournalListView`.
struct SearchView: View {

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: SearchViewModel

    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService
    private let media: MediaUploader
    private let onPrompt: (CreateEntryRequest) -> Void
    private let onRetryProcessing: ((String) -> Void)?

    init(
        ai: AIService,
        journals: JournalRepository,
        profiles: ProfileRepository,
        media: MediaUploader,
        onPrompt: @escaping (CreateEntryRequest) -> Void,
        onRetryProcessing: ((String) -> Void)? = nil
    ) {
        _viewModel = StateObject(wrappedValue: SearchViewModel(ai: ai))
        self.ai = ai
        self.journals = journals
        self.profiles = profiles
        self.media = media
        self.onPrompt = onPrompt
        self.onRetryProcessing = onRetryProcessing
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchBar
                modePicker
                Divider()
                resultBody
            }
            .background(Color.appBackground.ignoresSafeArea())
            .ignoresSafeArea(.keyboard)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.body.weight(.medium))
                    }
                    .accessibilityLabel("Close search")
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
                    onRetryProcessing: onRetryProcessing
                )
            }
        }
    }

    // MARK: - Search bar

    private var searchBar: some View {
        HStack(spacing: Spacing.s) {
            HStack(spacing: Spacing.s) {
                Image(systemName: "magnifyingglass")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)

                TextField("Search your journal…", text: $viewModel.query)
                    .textFieldStyle(.plain)
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                    .onSubmit { Task { await viewModel.search() } }

                if !viewModel.query.isEmpty {
                    Button {
                        viewModel.query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.uiBody)
                            .foregroundStyle(Color.textSecondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.horizontal, Spacing.m)
            .padding(.vertical, Spacing.s + 2)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                    .fill(Color.secondaryBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                    .strokeBorder(Color.textSecondary.opacity(0.18), lineWidth: 1)
            )

            Button {
                Task { await viewModel.search() }
            } label: {
                Text("Search")
                    .font(.uiBody.weight(.semibold))
            }
            .disabled(viewModel.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, Spacing.m)
        .padding(.top, Spacing.m)
        .padding(.bottom, Spacing.s)
    }

    // MARK: - Mode picker

    private var modePicker: some View {
        Picker("Search mode", selection: $viewModel.mode) {
            ForEach(SearchViewModel.Mode.allCases, id: \.self) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, Spacing.m)
        .padding(.bottom, Spacing.s)
    }

    // MARK: - Result body

    @ViewBuilder
    private var resultBody: some View {
        switch viewModel.state {
        case .idle:
            Spacer()
        case .loading:
            Spacer()
            ProgressView()
                .tint(Color.accentWarm)
            Spacer()
        case .results(let results):
            resultsList(results)
        case .empty:
            Spacer()
            EmptyStateView(
                systemImage: "magnifyingglass",
                title: "No results",
                message: "Nothing in your journal matches this search."
            )
            Spacer()
        case .error(let message):
            Spacer()
            EmptyStateView(
                systemImage: "wifi.exclamationmark",
                title: "Search unavailable",
                message: message,
                actionTitle: "Try again",
                action: { Task { await viewModel.search() } }
            )
            Spacer()
        }
    }

    private func resultsList(_ results: [SearchResult]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(results) { result in
                    NavigationLink(value: JournalDetailRoute(entryId: result.journalId)) {
                        SearchResultRow(result: result)
                    }
                    .buttonStyle(.plain)
                    Divider()
                        .padding(.leading, Spacing.m)
                }
            }
            .padding(.bottom, Spacing.xl)
        }
    }
}

// MARK: - Result row

private struct SearchResultRow: View {

    let result: SearchResult

    private var dateText: String {
        guard !result.date.isEmpty,
              let date = ISO8601DateFormatter().date(from: result.date + "T00:00:00Z")
        else { return result.date }
        return date.formatted(.dateTime.month(.abbreviated).day().year())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(result.title.isEmpty ? "Untitled" : result.title)
                .font(.entryTitle)
                .foregroundStyle(Color.primary)
                .lineLimit(1)

            Text(dateText)
                .font(.captionText)
                .foregroundStyle(Color.secondary)

            if !result.snippet.isEmpty {
                Text(result.snippet)
                    .font(.uiBody)
                    .foregroundStyle(Color.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, Spacing.m)
        .padding(.vertical, Spacing.s + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

// MARK: - Previews

#Preview("Results") {
    SearchView(
        ai: MockAIService(),
        journals: MockJournalRepository(entries: MockData.journalEntries),
        profiles: MockProfileRepository(),
        media: MockMediaUploader(),
        onPrompt: { _ in }
    )
}

#Preview("Dark") {
    SearchView(
        ai: MockAIService(),
        journals: MockJournalRepository(entries: MockData.journalEntries),
        profiles: MockProfileRepository(),
        media: MockMediaUploader(),
        onPrompt: { _ in }
    )
    .preferredColorScheme(.dark)
}
