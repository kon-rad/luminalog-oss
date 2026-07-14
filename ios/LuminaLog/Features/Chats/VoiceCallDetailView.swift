import SwiftUI

struct VoiceCallDetailView: View {
    @StateObject private var viewModel: VoiceCallDetailViewModel
    @StateObject private var audio = AudioPlayerController()
    @State private var selectedTab: DetailTab = .home
    @State private var isConfirmingDelete = false

    @Environment(\.dismiss) private var dismiss

    enum DetailTab: String, CaseIterable {
        case home = "Home"
        case transcript = "Transcript"
        case messages = "Messages"
    }

    init(
        chatId: String,
        repository: ChatRepository,
        // `api` is retained (unused) so the existing ChatListView call site keeps
        // compiling; Task 8 rewires the caller to pass `media`/`importer` directly
        // and drops this parameter.
        api: ProxyAPIClient? = nil,
        media: MediaUploader? = nil,
        importer: VoiceRecordingImporter? = nil
    ) {
        _viewModel = StateObject(wrappedValue: VoiceCallDetailViewModel(chatId: chatId, repository: repository, media: media, importer: importer))
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Tab", selection: $selectedTab) {
                ForEach(DetailTab.allCases, id: \.self) {
                    Text($0.rawValue).tag($0)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Spacing.m)
            .padding(.vertical, Spacing.s)

            Divider()
                .foregroundStyle(Color.textSecondary.opacity(0.15))

            switch selectedTab {
            case .home:
                homeTab
            case .transcript:
                transcriptTab
            case .messages:
                messagesTab
            }
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle(viewModel.chat?.title.isEmpty == false ? viewModel.chat!.title : "Voice call")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(role: .destructive) {
                        isConfirmingDelete = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .foregroundStyle(Color.accentWarm)
                }
            }
        }
        .confirmationDialog(
            "Delete this call?",
            isPresented: $isConfirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deleteChat()
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The recording, transcript, and all messages will be permanently removed.")
        }
        .task { await viewModel.start() }
        .onChange(of: viewModel.recordingURL) { _, url in
            audio.load(url: url, fallbackDuration: viewModel.chat?.recordingDurationSeconds)
        }
        .onDisappear { audio.teardown() }
    }

    // MARK: - Home tab

    private var homeTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.m) {
                playerCard
                metadataGrid
            }
            .padding(Spacing.m)
        }
    }

    @ViewBuilder private var playerCard: some View {
        switch viewModel.recordingState {
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(Spacing.l)
        case .unavailable:
            HStack(spacing: Spacing.s) {
                Image(systemName: "waveform.slash")
                    .foregroundStyle(Color.textSecondary)
                Text("Recording not available")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(Spacing.m)
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous))
        case .processing:
            HStack(spacing: Spacing.s) {
                ProgressView()
                Text("Processing recording…")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(Spacing.m)
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous))
        case .ready:
            VStack(spacing: Spacing.s) {
                HStack(spacing: Spacing.m) {
                    Button {
                        audio.togglePlayPause()
                    } label: {
                        Image(systemName: audio.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(Color.accentWarm)
                    }
                    .buttonStyle(.plain)

                    VStack(alignment: .leading, spacing: 4) {
                        Slider(
                            value: Binding(
                                get: { audio.currentTime },
                                set: { audio.setScrubTime($0) }
                            ),
                            in: 0...max(audio.duration, 0.1),
                            onEditingChanged: { audio.scrubbing($0) }
                        )
                        .tint(Color.accentWarm)

                        HStack {
                            Text(formatTime(audio.currentTime))
                            Spacer()
                            Text(formatTime(audio.duration))
                        }
                        .font(.captionText.monospacedDigit())
                        .foregroundStyle(Color.textSecondary)
                    }

                    if let url = viewModel.recordingURL {
                        ShareLink(item: url) {
                            Image(systemName: "arrow.down.circle")
                                .font(.system(size: 28))
                                .foregroundStyle(Color.accentWarm)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(Spacing.m)
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous))
        }
    }

    private var metadataGrid: some View {
        let duration = viewModel.chat?.recordingDurationSeconds ?? (audio.duration > 0 ? audio.duration : nil)
        let date = viewModel.chat?.createdAt
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.m) {
            MetadataTile(label: "Words", value: "\(viewModel.wordCount)")
            MetadataTile(label: "Duration", value: formatDuration(duration))
            MetadataTile(
                label: "Date",
                value: date.map { $0.formatted(date: .abbreviated, time: .omitted) } ?? "—"
            )
            MetadataTile(label: "Messages", value: "\(viewModel.messages.count)")
        }
    }

    // MARK: - Transcript tab

    @ViewBuilder private var transcriptTab: some View {
        if viewModel.messages.isEmpty {
            EmptyStateView(
                systemImage: "text.bubble",
                title: "No transcript",
                message: "The transcript will appear here after the call is processed."
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s) {
                    ForEach(viewModel.messages) { message in
                        TranscriptMessageRow(message: message)
                    }
                }
                .padding(Spacing.m)
            }
        }
    }

    // MARK: - Messages tab

    private var messagesTab: some View {
        ScrollView {
            VStack(spacing: Spacing.s) {
                ForEach(viewModel.messages) { message in
                    MessageBubble(text: message.text, role: message.role)
                    if let sources = message.sources, !sources.isEmpty {
                        SourcesDisclosure(sources: sources)
                    }
                }
            }
            .padding(Spacing.m)
        }
    }

    // MARK: - Helpers

    private func formatTime(_ seconds: Double) -> String {
        let s = max(0, Int(seconds))
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    private func formatDuration(_ seconds: Double?) -> String {
        guard let s = seconds, s > 0 else { return "—" }
        return formatTime(s)
    }
}

// MARK: - Metadata tile

private struct MetadataTile: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(label)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
            Text(value)
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.m)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous))
    }
}

// MARK: - Transcript message row

private struct TranscriptMessageRow: View {
    let message: ChatMessage

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(message.role == .user ? "You" : "LuminaLog")
                .font(.captionText.weight(.semibold))
                .foregroundStyle(message.role == .user ? Color.accentWarm : Color.textSecondary)
            Text(message.text)
                .font(.uiBody)
                .foregroundStyle(Color.textPrimary)
            Text(message.createdAt, style: .time)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.m)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous))
    }
}

// MARK: - Sources disclosure

private struct SourcesDisclosure: View {
    let sources: [MessageSource]
    @State private var expanded = false

    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: Spacing.s) {
                ForEach(Array(sources.enumerated()), id: \.offset) { _, source in
                    NavigationLink(value: JournalDetailRoute(entryId: source.journalId)) {
                        SourceChunkRow(source: source)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, Spacing.xs)
        } label: {
            Text("Sources (\(sources.count))")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(.leading, Spacing.m)
        .tint(Color.textSecondary)
    }
}

private struct SourceChunkRow: View {
    let source: MessageSource

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(source.title.isEmpty ? source.journalId : source.title)
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                    if !source.date.isEmpty {
                        Text(source.date)
                            .font(.captionText)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                Spacer()
                if source.score > 0 {
                    Text(String(format: "%.0f%%", source.score * 100))
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Image(systemName: "chevron.right")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
            if !source.snippet.isEmpty {
                Text(source.snippet)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(Spacing.s)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous))
    }
}
