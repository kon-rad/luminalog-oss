import SwiftUI

/// Post-call detail screen: audio playback, the conversation as chat bubbles
/// with per-message RAG sources, and the raw verbatim transcript.
struct VoiceCallDetailView: View {
    @StateObject private var viewModel: VoiceCallDetailViewModel
    @StateObject private var audio = AudioPlayerController()
    @State private var showRawTranscript = false

    init(chatId: String, repository: ChatRepository, api: ProxyAPIClient?) {
        _viewModel = StateObject(wrappedValue: VoiceCallDetailViewModel(chatId: chatId, repository: repository, api: api))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.l) {
                header
                playerSection
                ForEach(viewModel.messages) { message in
                    MessageBubble(text: message.text, role: message.role)
                    if let sources = message.sources, !sources.isEmpty {
                        SourcesDisclosure(sources: sources)
                    }
                }
                rawTranscriptSection
            }
            .padding(Spacing.m)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Voice call")
        .task { await viewModel.start() }
        .onChange(of: viewModel.recordingURL) { _, url in
            audio.load(url: url, fallbackDuration: viewModel.chat?.recordingDurationSeconds)
        }
        .onDisappear { audio.teardown() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(viewModel.chat?.title.isEmpty == false ? viewModel.chat!.title : "Voice call")
                .font(.uiTitle)
            if let reason = viewModel.chat?.endedReason, !reason.isEmpty {
                Text("Ended: \(reason)")
                    .font(.uiCaption)
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }

    @ViewBuilder private var playerSection: some View {
        switch viewModel.recordingState {
        case .loading:
            ProgressView().frame(maxWidth: .infinity)
        case .unavailable:
            Text("Recording not available")
                .font(.uiCaption)
                .foregroundStyle(Color.textSecondary)
        case .ready:
            HStack(spacing: Spacing.m) {
                Button {
                    audio.togglePlayPause()
                } label: {
                    Image(systemName: audio.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(Color.accentWarm)
                }
                .buttonStyle(.plain)
                Slider(
                    value: Binding(
                        get: { audio.currentTime },
                        set: { audio.setScrubTime($0) }
                    ),
                    in: 0...max(audio.duration, 0.1),
                    onEditingChanged: { audio.scrubbing($0) }
                )
            }
        }
    }

    @ViewBuilder private var rawTranscriptSection: some View {
        if let raw = viewModel.chat?.rawTranscript, !raw.isEmpty {
            DisclosureGroup("Raw transcript", isExpanded: $showRawTranscript) {
                Text(raw)
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

/// Expandable list of the journal chunks that informed an assistant reply.
private struct SourcesDisclosure: View {
    let sources: [MessageSource]
    @State private var expanded = false

    var body: some View {
        DisclosureGroup("Sources (\(sources.count))", isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: Spacing.s) {
                ForEach(Array(sources.enumerated()), id: \.offset) { _, s in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(s.title.isEmpty ? s.journalId : s.title) · \(s.type) · \(s.date)")
                            .font(.uiCaption.weight(.semibold))
                        Text(String(format: "match %.0f%%", s.score * 100))
                            .font(.uiCaption)
                            .foregroundStyle(Color.textSecondary)
                        if !s.snippet.isEmpty {
                            Text(s.snippet)
                                .font(.uiCaption)
                                .foregroundStyle(Color.textSecondary)
                                .lineLimit(3)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .font(.uiCaption)
    }
}
