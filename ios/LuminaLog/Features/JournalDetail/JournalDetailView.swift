import SwiftUI

/// Navigation route to a journal entry's detail screen.
/// Home and the Journal list push this value onto their NavigationStacks.
struct JournalDetailRoute: Hashable {
    let entryId: String
}

/// Journal Detail screen (design §4): entry title + date, Main / Insights /
/// Prompts tabs, and the four per-type Main content variants.
struct JournalDetailView: View {

    @StateObject private var viewModel: JournalDetailViewModel

    private let media: MediaUploader
    /// Opens the Create flow seeded with a generated prompt (design §4 Tab 3).
    private let onPrompt: (CreateEntryRequest) -> Void

    @State private var selectedTab: JournalDetailTab

    init(
        entryId: String,
        journals: JournalRepository,
        ai: AIService,
        media: MediaUploader,
        onPrompt: @escaping (CreateEntryRequest) -> Void,
        initialTab: JournalDetailTab = .main
    ) {
        _viewModel = StateObject(
            wrappedValue: JournalDetailViewModel(entryId: entryId, journals: journals, ai: ai)
        )
        self.media = media
        self.onPrompt = onPrompt
        _selectedTab = State(initialValue: initialTab)
    }

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            if let entry = viewModel.entry {
                loadedBody(entry)
            } else if viewModel.hasLoaded {
                EmptyStateView(
                    systemImage: "book.closed",
                    title: "Entry not found",
                    message: "This journal entry is no longer available."
                )
            } else {
                ProgressView()
                    .tint(Color.accentWarm)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let entry = viewModel.entry {
                    TypePill(type: entry.type)
                }
            }
        }
        .task {
            await viewModel.start()
        }
    }

    // MARK: - Layout

    private func loadedBody(_ entry: JournalEntry) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            titleHeader(entry)
                .padding(.horizontal, Spacing.m)
                .padding(.bottom, Spacing.m)

            DetailTabBar(selection: $selectedTab)

            ScrollView {
                Group {
                    switch selectedTab {
                    case .main:
                        mainTab(entry)
                    case .insights:
                        insightsTab(entry)
                    case .prompts:
                        promptsTab(entry)
                    }
                }
                .padding(Spacing.m)
                .padding(.bottom, Spacing.xl)
            }
        }
    }

    private func titleHeader(_ entry: JournalEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(entry.title)
                .font(.journalTitle)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Text(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Main tab

    private func mainTab(_ entry: JournalEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.l) {
            summarySection(entry)

            switch entry.type {
            case .text:
                textContent(entry)
            case .image:
                imageContent(entry)
            case .voice:
                voiceContent(entry)
            case .video:
                videoContent(entry)
            }
        }
    }

    @ViewBuilder
    private func summarySection(_ entry: JournalEntry) -> some View {
        if let summary = entry.summary {
            SummaryCard(
                text: summary.text,
                showsRegenerate: viewModel.isSummaryStale,
                isRegenerating: viewModel.summaryState == .loading,
                onRegenerate: { Task { await viewModel.generateSummary() } }
            )
        } else {
            switch viewModel.summaryState {
            case .loading:
                SummaryPendingCard()
            case .failed:
                SummaryRetryRow {
                    Task { await viewModel.generateSummary() }
                }
            case .idle:
                // Pre-start instant; the lazy generation kicks in on start.
                EmptyView()
            }
        }
    }

    // MARK: Main content variants

    private func textContent(_ entry: JournalEntry) -> some View {
        Text(entry.content)
            .font(.journalBody)
            .foregroundStyle(Color.textPrimary)
            .lineSpacing(6)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func imageContent(_ entry: JournalEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            ForEach(entry.media.filter { $0.kind == .image }, id: \.s3Key) { item in
                EntryImageView(item: item, media: media)
            }

            transcriptSection(entry, label: "Transcribed text")
        }
    }

    private func voiceContent(_ entry: JournalEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            if let item = entry.media.first(where: { $0.kind == .audio }) {
                AudioPlayerCard(item: item, media: media)
            }

            transcriptSection(entry, label: "Transcript")
        }
    }

    private func videoContent(_ entry: JournalEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            if let item = entry.media.first(where: { $0.kind == .video }) {
                VideoPlayerCard(item: item, media: media)
            }

            transcriptSection(entry, label: "Transcript")
        }
    }

    @ViewBuilder
    private func transcriptSection(_ entry: JournalEntry, label: String) -> some View {
        switch entry.transcriptStatus {
        case .processing:
            transcribingHint
        case .failed:
            transcriptFailedRow
        case .ready, nil:
            if !entry.content.isEmpty {
                TranscriptBlock(label: label, text: entry.content)
            }
        }
    }

    private var transcribingHint: some View {
        HStack(spacing: Spacing.s) {
            ProgressView()
                .controlSize(.small)
                .tint(Color.accentWarm)
            Text("Transcribing…")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.secondaryBackground)
        )
        .accessibilityLabel("Transcribing")
    }

    private var transcriptFailedRow: some View {
        HStack(spacing: Spacing.s) {
            Text("Transcription failed.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)

            Button {
                // TODO: Task 7 owns re-transcription; wire this up there.
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Retry")
                }
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Retry transcription")

            Spacer()
        }
        .padding(.horizontal, Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.secondaryBackground)
        )
    }

    // MARK: - Insights tab

    @ViewBuilder
    private func insightsTab(_ entry: JournalEntry) -> some View {
        if let insights = entry.insights {
            VStack(alignment: .leading, spacing: Spacing.l) {
                ForEach(Array(Self.paragraphs(of: insights.text).enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .font(.journalBody)
                        .foregroundStyle(Color.textPrimary)
                        .lineSpacing(6)
                        .fixedSize(horizontal: false, vertical: true)
                }

                AIActionButton(
                    title: "Regenerate",
                    loadingTitle: "Analyzing your entry…",
                    state: viewModel.insightsState,
                    action: { Task { await viewModel.generateInsights() } }
                )
                .padding(.top, Spacing.s)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(spacing: Spacing.m) {
                EmptyStateView(
                    systemImage: "sparkles",
                    title: "No insights yet",
                    message: "Let your AI companion reflect on this entry — themes, emotions, and patterns worth noticing."
                )

                AIActionButton(
                    title: "Generate Insights",
                    loadingTitle: "Analyzing your entry…",
                    state: viewModel.insightsState,
                    action: { Task { await viewModel.generateInsights() } }
                )
            }
        }
    }

    /// Insights text rendered as simple well-spaced paragraphs (split on
    /// blank lines).
    private static func paragraphs(of text: String) -> [String] {
        text
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    // MARK: - Prompts tab

    @ViewBuilder
    private func promptsTab(_ entry: JournalEntry) -> some View {
        if let prompts = entry.prompts, !prompts.items.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s) {
                ForEach(Array(prompts.items.enumerated()), id: \.offset) { _, prompt in
                    PromptCard.listItem(question: prompt) {
                        onPrompt(CreateEntryRequest(promptText: prompt))
                    }
                }

                AIActionButton(
                    title: "Regenerate",
                    loadingTitle: "Writing new prompts…",
                    state: viewModel.promptsState,
                    action: { Task { await viewModel.generatePrompts() } }
                )
                .padding(.top, Spacing.m)
            }
        } else {
            VStack(spacing: Spacing.m) {
                EmptyStateView(
                    systemImage: "lightbulb",
                    title: "No prompts yet",
                    message: "Generate five journaling prompts inspired by this entry's themes."
                )

                AIActionButton(
                    title: "Generate Prompts",
                    loadingTitle: "Writing prompts…",
                    state: viewModel.promptsState,
                    action: { Task { await viewModel.generatePrompts() } }
                )
            }
        }
    }
}

// MARK: - Previews

#Preview("Text") {
    JournalDetailPreview(entryId: "demo-entry-01")
}

#Preview("Voice") {
    JournalDetailPreview(entryId: "demo-entry-02")
}

#Preview("Image") {
    JournalDetailPreview(entryId: "demo-entry-04")
}

#Preview("Video") {
    JournalDetailPreview(entryId: "demo-entry-06")
}

#Preview("Insights — saved") {
    JournalDetailPreview(entryId: "demo-entry-02", tab: .insights)
}

#Preview("Insights — empty") {
    JournalDetailPreview(entryId: "demo-entry-01", tab: .insights)
}

#Preview("Prompts — saved") {
    JournalDetailPreview(entryId: "demo-entry-01", tab: .prompts)
}

#Preview("Prompts — empty") {
    JournalDetailPreview(entryId: "demo-entry-04", tab: .prompts)
}

#Preview("Dark — Voice") {
    JournalDetailPreview(entryId: "demo-entry-02")
        .preferredColorScheme(.dark)
}

private struct JournalDetailPreview: View {
    let entryId: String
    var tab: JournalDetailTab = .main

    var body: some View {
        NavigationStack {
            JournalDetailView(
                entryId: entryId,
                journals: MockJournalRepository(),
                ai: MockAIService(),
                media: MockMediaUploader(),
                onPrompt: { _ in },
                initialTab: tab
            )
        }
    }
}
