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

    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService
    private let media: MediaUploader
    /// Opens the Create flow seeded with a generated prompt (design §4 Tab 3).
    private let onPrompt: (CreateEntryRequest) -> Void
    /// Retries a background upload/save that failed after dismissal. Nil in
    /// previews (the retry affordance is then hidden).
    private let onRetryProcessing: ((String) -> Void)?
    /// Called when the user picks text or voice from the journal chat picker.
    /// Nil when the caller doesn't support journal-linked chats.
    private let onStartJournalChat: ((String, String, ChatKind) -> Void)?

    @State private var selectedTab: JournalDetailTab
    @State private var isEditingTranscript = false
    @State private var isShowingOptions = false
    @State private var isEditingEntry = false
    @State private var isShowingJournalChat = false

    @Environment(\.dismiss) private var dismiss

    init(
        entryId: String,
        journals: JournalRepository,
        profiles: ProfileRepository,
        ai: AIService,
        media: MediaUploader,
        onPrompt: @escaping (CreateEntryRequest) -> Void,
        onRetryProcessing: ((String) -> Void)? = nil,
        onStartJournalChat: ((String, String, ChatKind) -> Void)? = nil,
        initialTab: JournalDetailTab = .main
    ) {
        _viewModel = StateObject(
            wrappedValue: JournalDetailViewModel(
                entryId: entryId,
                journals: journals,
                ai: ai
            )
        )
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
        self.media = media
        self.onPrompt = onPrompt
        self.onRetryProcessing = onRetryProcessing
        self.onStartJournalChat = onStartJournalChat
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
            .hidesToolbarGlassBackground()
            ToolbarItem(placement: .topBarTrailing) {
                if viewModel.entry != nil {
                    Button {
                        isShowingOptions = true
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Entry options")
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

            processingBanner(entry)

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
                    case .related:
                        RelatedTabView(entryId: entry.id, ai: ai)
                    }
                }
                .padding(Spacing.m)
                .padding(.bottom, Spacing.xl)
            }
        }
        .sheet(isPresented: $isEditingTranscript) {
            if let entry = viewModel.entry {
                TranscriptEditorView(
                    entryId: entry.id,
                    entryCreatedAt: entry.createdAt,
                    initialText: entry.content,
                    journals: journals,
                    profiles: profiles,
                    ai: ai,
                    media: media
                )
            }
        }
        .sheet(isPresented: $isShowingOptions) {
            if let entry = viewModel.entry {
                EntryOptionsView(
                    entry: entry,
                    onEdit: { isEditingEntry = true },
                    onDelete: { Task { await viewModel.delete() } }
                )
            }
        }
        .sheet(isPresented: $isEditingEntry) {
            if let entry = viewModel.entry {
                EntryEditView(entry: entry, journals: journals, profiles: profiles, ai: ai)
            }
        }
        .sheet(isPresented: $isShowingJournalChat) {
            if let entry = viewModel.entry {
                JournalChatPickerSheet(journalTitle: entry.title) { kind in
                    onStartJournalChat?(entry.id, entry.title, kind)
                }
            }
        }
        .onChange(of: viewModel.didDelete) { _, didDelete in
            if didDelete { dismiss() }
        }
    }

    /// Surfaces the background upload/save pipeline (before server
    /// transcription, which the transcript section handles). Shows progress for
    /// in-flight phases and a retry affordance when an upload/save failed.
    @ViewBuilder
    private func processingBanner(_ entry: JournalEntry) -> some View {
        switch entry.processingStatus {
        case .processing, .uploading, .saving:
            HStack(spacing: Spacing.s) {
                ProgressView()
                    .controlSize(.small)
                    .tint(Color.accentWarm)
                Text(entry.statusBadgeText ?? "Working…")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
            }
            .padding(.horizontal, Spacing.m)
            .padding(.bottom, Spacing.s)

        case .failed:
            HStack(spacing: Spacing.s) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.danger)
                Text("Upload didn't finish.")
                    .font(.captionText)
                    .foregroundStyle(Color.danger)
                Spacer()
                if let onRetryProcessing {
                    Button {
                        onRetryProcessing(entry.id)
                    } label: {
                        Text("Retry")
                            .font(.captionText.weight(.semibold))
                            .foregroundStyle(Color.accentWarm)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Retry upload")
                }
            }
            .padding(.horizontal, Spacing.m)
            .padding(.bottom, Spacing.s)

        case .transcribing, .ready, .none:
            EmptyView()
        }
    }

    private func titleHeader(_ entry: JournalEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(entry.title)
                .font(.journalDetailTitle)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)

            HStack(alignment: .firstTextBaseline) {
                Text(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                Spacer(minLength: Spacing.s)
                Text(wordCountLabel(entry.wordCount))
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                    .accessibilityLabel("\(entry.wordCount) words")
                if onStartJournalChat != nil {
                    Text("·")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                    Button("Chat ›") {
                        isShowingJournalChat = true
                    }
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
                    .buttonStyle(.plain)
                    .accessibilityLabel("Start chat about this entry")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func wordCountLabel(_ count: Int) -> String {
        count == 1 ? "1 word" : "\(count) words"
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

            excludeFromShareToggle(entry)
        }
    }

    private func excludeFromShareToggle(_ entry: JournalEntry) -> some View {
        Toggle(
            "Exclude from shareable insights",
            isOn: Binding(
                get: { viewModel.entry?.excludeFromShare ?? false },
                set: { viewModel.setExcludeFromShare($0) }
            )
        )
        .font(.captionText)
        .foregroundStyle(Color.textSecondary)
        .tint(Color.accentWarm)
        .padding(.top, Spacing.s)
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
        } else if !entry.content.isEmpty {
            // Only show generation states when content exists to summarize.
            switch viewModel.summaryState {
            case .loading:
                SummaryPendingCard()
            case .failed:
                SummaryRetryRow {
                    Task { await viewModel.generateSummary() }
                }
            case .idle:
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

            // One player per recorded voice memo.
            ForEach(entry.media.filter { $0.kind == .audio }, id: \.s3Key) { item in
                AudioPlayerCard(item: item, media: media)
            }

            // Always editable for image entries, even when there's no text yet.
            TranscriptBlock(
                label: "Transcribed text",
                text: entry.content.isEmpty
                    ? "No transcript yet. Tap Edit to add one."
                    : entry.content,
                onEdit: { isEditingTranscript = true }
            )
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
            Text(viewModel.transcriptRetryState == .loading ? "Retrying…" : "Transcribing…")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
            Spacer()
            if viewModel.transcriptRetryState != .loading {
                Button {
                    Task { await viewModel.retryTranscription() }
                } label: {
                    Text("Retry")
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Retry transcription")
            }
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.secondaryBackground)
        )
        .accessibilityLabel(viewModel.transcriptRetryState == .loading ? "Retrying" : "Transcribing")
    }

    private var transcriptFailedRow: some View {
        HStack(spacing: Spacing.s) {
            Text(viewModel.transcriptRetryState == .failed
                ? "Retry failed."
                : "Transcription failed.")
                .font(.captionText)
                .foregroundStyle(viewModel.transcriptRetryState == .failed
                    ? Color.danger
                    : Color.textSecondary)

            if viewModel.transcriptRetryState == .loading {
                HStack(spacing: Spacing.xs) {
                    ProgressView()
                        .controlSize(.small)
                        .tint(Color.accentWarm)
                    Text("Retrying…")
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(minHeight: 44)
                .accessibilityLabel("Retrying transcription")
            } else {
                Button {
                    Task { await viewModel.retryTranscription() }
                } label: {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 11, weight: .semibold))
                        Text(viewModel.transcriptRetryState == .failed ? "Try Again" : "Retry")
                    }
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Retry transcription")
            }

            Spacer()
        }
        .padding(.horizontal, Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.secondaryBackground)
        )
    }

    // MARK: - Insights tab

    /// True while the entry has content to analyze but the server-generated AI
    /// fields (summary + insights + prompts) have not yet landed — the tabs show
    /// a quiet "analyzing" state until indexing completes. Once `vector.status`
    /// is terminal (`.indexed`/`.failed`) an absent field means "none".
    private func aiIsPending(_ entry: JournalEntry) -> Bool {
        !entry.content.isEmpty && entry.vector.status == .pending
    }

    /// Read-only Insights tab: displays the server-generated insights stored on
    /// the entry (produced with the summary + prompts in one call at index time).
    /// No generate/regenerate affordance.
    @ViewBuilder
    private func insightsTab(_ entry: JournalEntry) -> some View {
        if let insights = entry.insights, !insights.text.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.m) {
                ForEach(Array(Self.insightBlocks(of: insights.text).enumerated()), id: \.offset) { _, block in
                    insightBlockView(block)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if aiIsPending(entry) {
            aiPendingRow("Analyzing your entry…")
        } else {
            EmptyStateView(
                systemImage: "sparkles",
                title: "No insights yet",
                message: "Insights appear automatically once your AI companion has reflected on this entry."
            )
        }
    }

    /// Quiet in-flight row shown on the Insights/Prompts tabs while the entry's
    /// AI fields are still being generated server-side.
    private func aiPendingRow(_ label: String) -> some View {
        HStack(spacing: Spacing.s) {
            ProgressView()
                .controlSize(.small)
                .tint(Color.accentWarm)
            Text(label)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.secondaryBackground)
        )
        .accessibilityLabel(label)
    }

    /// A parsed block of the Markdown-formatted insights text.
    private enum InsightBlock {
        case heading(String, level: Int)
        case bullet(String)
        case paragraph(String)
    }

    /// Renders a single parsed insights block with theme typography.
    @ViewBuilder
    private func insightBlockView(_ block: InsightBlock) -> some View {
        switch block {
        case let .heading(text, level):
            Text(Self.inlineMarkdown(text))
                .font(level <= 2 ? .sectionHeader : .entryTitle)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, Spacing.s)
        case let .bullet(text):
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
                Text("•")
                    .font(.journalBody)
                    .foregroundStyle(Color.textSecondary)
                Text(Self.inlineMarkdown(text))
                    .font(.journalBody)
                    .foregroundStyle(Color.textPrimary)
                    .lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
            }
        case let .paragraph(text):
            Text(Self.inlineMarkdown(text))
                .font(.journalBody)
                .foregroundStyle(Color.textPrimary)
                .lineSpacing(6)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Parses inline Markdown (bold, italic, links) into an `AttributedString`,
    /// falling back to plain text if parsing fails.
    private static func inlineMarkdown(_ text: String) -> AttributedString {
        (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)
    }

    /// Splits Markdown-formatted insights text into renderable blocks. Headings
    /// (`#`), bullet lists (`-`/`*`) are single lines; consecutive plain lines
    /// are merged into a paragraph, and blank lines separate paragraphs.
    private static func insightBlocks(of text: String) -> [InsightBlock] {
        var blocks: [InsightBlock] = []
        var paragraphLines: [String] = []

        func flushParagraph() {
            let joined = paragraphLines
                .joined(separator: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !joined.isEmpty { blocks.append(.paragraph(joined)) }
            paragraphLines.removeAll()
        }

        for rawLine in text.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                flushParagraph()
            } else if line.hasPrefix("#") {
                flushParagraph()
                let hashes = line.prefix { $0 == "#" }
                let content = line.dropFirst(hashes.count).trimmingCharacters(in: .whitespaces)
                if !content.isEmpty { blocks.append(.heading(content, level: hashes.count)) }
            } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
                flushParagraph()
                blocks.append(.bullet(String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces)))
            } else {
                paragraphLines.append(line)
            }
        }
        flushParagraph()
        return blocks
    }

    // MARK: - Prompts tab

    /// Read-only Prompts tab: displays the five server-generated follow-up
    /// prompts stored on the entry. Tapping one still seeds a new entry; there is
    /// no generate/regenerate affordance.
    @ViewBuilder
    private func promptsTab(_ entry: JournalEntry) -> some View {
        if let prompts = entry.prompts, !prompts.items.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s) {
                ForEach(Array(prompts.items.enumerated()), id: \.offset) { _, prompt in
                    PromptCard.listItem(question: prompt) {
                        onPrompt(CreateEntryRequest(promptText: prompt))
                    }
                }
            }
        } else if aiIsPending(entry) {
            aiPendingRow("Writing prompts…")
        } else {
            EmptyStateView(
                systemImage: "lightbulb",
                title: "No prompts yet",
                message: "Follow-up prompts appear automatically once your AI companion has reflected on this entry."
            )
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
                profiles: MockProfileRepository(),
                ai: MockAIService(),
                media: MockMediaUploader(),
                onPrompt: { _ in },
                initialTab: tab
            )
        }
    }
}

private extension ToolbarContent {
    /// Drops the system Liquid Glass capsule that iOS 26 wraps around toolbar
    /// items, so the type pill reads as a single solid-colored tag (no nested
    /// light envelope). No-op on earlier OS versions.
    @ToolbarContentBuilder
    func hidesToolbarGlassBackground() -> some ToolbarContent {
        if #available(iOS 26, *) {
            self.sharedBackgroundVisibility(.hidden)
        } else {
            self
        }
    }
}
