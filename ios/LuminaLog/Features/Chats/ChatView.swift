import SwiftUI

/// Text chat conversation screen (design §7), also used read-only for voice
/// call transcripts (input hidden, banner shown).
struct ChatView: View {

    @StateObject private var viewModel: ChatViewModel

    /// True when the user is scrolled near the bottom — only then does new
    /// content auto-scroll (respects reading back through history).
    @State private var isNearBottom = true

    private static let bottomAnchorId = "chat-bottom"

    init(
        chatId: String,
        kind: ChatKind,
        title: String,
        chats: ChatRepository,
        ai: AIService,
        speech: SpeechTranscriber
    ) {
        _viewModel = StateObject(
            wrappedValue: ChatViewModel(
                chatId: chatId,
                kind: kind,
                title: title,
                chats: chats,
                ai: ai,
                speech: speech
            )
        )
    }

    #if DEBUG
    /// Preview hook: render with a preconfigured view model (streaming,
    /// failed-send, and other transient states).
    init(previewViewModel: ChatViewModel) {
        _viewModel = StateObject(wrappedValue: previewViewModel)
    }
    #endif

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isReadOnly {
                transcriptBanner
            }
            conversation
            if !viewModel.isReadOnly {
                ChatInputBar(
                    text: $viewModel.draft,
                    isListening: viewModel.dictationState == .listening,
                    canSend: viewModel.canSend,
                    onMic: { Task { await viewModel.toggleDictation() } },
                    onSend: { Task { await viewModel.send() } }
                )
            }
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle(viewModel.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.start()
        }
        .onDisappear {
            viewModel.stopDictation()
        }
        .alert("Microphone access needed", isPresented: $viewModel.showDictationDeniedAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Enable microphone and speech recognition for LuminaLog in Settings to dictate messages.")
        }
    }

    // MARK: - Conversation scroll

    private var conversation: some View {
        GeometryReader { outer in
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: Spacing.s) {
                        if viewModel.showsGreeting {
                            MessageBubble(text: ChatViewModel.greetingText, role: .assistant)
                        }

                        messageRows

                        if let failed = viewModel.failedSend {
                            if !failed.isPersisted {
                                MessageBubble(text: failed.message.text, role: .user, isFailed: true)
                            }
                            FailedSendRow(
                                onRetry: { Task { await viewModel.retry() } },
                                onDiscard: { viewModel.discardFailedSend() }
                            )
                        }

                        if viewModel.isAwaitingFirstToken {
                            TypingIndicator()
                        }

                        if let partial = viewModel.streamingReply {
                            MessageBubble(text: partial, role: .assistant, isStreaming: true)
                        }

                        Color.clear
                            .frame(height: 1)
                            .id(Self.bottomAnchorId)
                    }
                    .padding(.horizontal, Spacing.m)
                    .padding(.top, Spacing.m)
                    .background(
                        GeometryReader { inner in
                            Color.clear.preference(
                                key: BottomDistancePreferenceKey.self,
                                value: inner.frame(in: .global).maxY - outer.frame(in: .global).maxY
                            )
                        }
                    )
                }
                .scrollDismissesKeyboard(.interactively)
                .onPreferenceChange(BottomDistancePreferenceKey.self) { distance in
                    isNearBottom = distance < 120
                }
                .onChange(of: viewModel.messages.count) {
                    scrollToBottom(proxy, animated: true)
                }
                .onChange(of: viewModel.streamingReply) {
                    scrollToBottom(proxy, animated: false)
                }
                .onChange(of: viewModel.isAwaitingFirstToken) {
                    scrollToBottom(proxy, animated: true)
                }
                .onChange(of: viewModel.hasLoaded) {
                    // First load: jump straight to the latest message.
                    proxy.scrollTo(Self.bottomAnchorId, anchor: .bottom)
                }
            }
        }
    }

    /// Bubbles with a relative timestamp under the last message of each
    /// same-role run (keeps the conversation visually grouped).
    @ViewBuilder
    private var messageRows: some View {
        let messages = viewModel.messages
        ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
            MessageBubble(text: message.text, role: message.role)
            if isEndOfGroup(index, in: messages) {
                BubbleTimestamp(date: message.createdAt, role: message.role)
            }
        }
    }

    private func isEndOfGroup(_ index: Int, in messages: [ChatMessage]) -> Bool {
        guard index + 1 < messages.count else { return true }
        return messages[index + 1].role != messages[index].role
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy, animated: Bool) {
        guard isNearBottom else { return }
        if animated {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(Self.bottomAnchorId, anchor: .bottom)
            }
        } else {
            proxy.scrollTo(Self.bottomAnchorId, anchor: .bottom)
        }
    }

    // MARK: - Read-only banner

    private var transcriptBanner: some View {
        HStack(spacing: Spacing.s) {
            Image(systemName: "waveform")
                .font(.captionText.weight(.semibold))
            Text("Voice call transcript")
                .font(.captionText.weight(.semibold))
        }
        .foregroundStyle(Color.tintVoice)
        .padding(.vertical, Spacing.s)
        .frame(maxWidth: .infinity)
        .background(Color.tintVoice.opacity(0.12))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Bottom-distance preference

/// Distance (pt) between the content's bottom edge and the viewport's bottom
/// edge — ~0 when scrolled fully down, large when reading history.
private struct BottomDistancePreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Failed send row

/// Inline error with Retry/Discard after a message fails (design §7).
private struct FailedSendRow: View {

    let onRetry: () -> Void
    let onDiscard: () -> Void

    var body: some View {
        HStack(spacing: Spacing.m) {
            Spacer()
            Label("Not sent", systemImage: "exclamationmark.circle")
                .font(.captionText)
                .foregroundStyle(Color.tintVoice)
            Button("Retry", action: onRetry)
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
            Button("Discard", action: onDiscard)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(.trailing, Spacing.xs)
    }
}

// MARK: - Input bar

/// Bottom input bar: expanding text field, dictation mic, and send button.
struct ChatInputBar: View {

    @Binding var text: String
    let isListening: Bool
    let canSend: Bool
    let onMic: () -> Void
    let onSend: () -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: Spacing.s) {
            HStack(alignment: .bottom, spacing: Spacing.s) {
                TextField("Message your journal…", text: $text, axis: .vertical)
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1...4)
                    .focused($isFocused)

                Button(action: onMic) {
                    Image(systemName: isListening ? "mic.fill" : "mic")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(isListening ? Color.tintVoice : Color.textSecondary)
                        .symbolEffect(.pulse, isActive: isListening)
                        .frame(width: 32, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isListening ? "Stop dictation" : "Dictate a message")
            }
            .padding(.horizontal, Spacing.m)
            .padding(.vertical, Spacing.s + 2)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.xLarge, style: .continuous)
                    .fill(Color.cardBackground)
            )

            Button(action: onSend) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(canSend ? Color.accentWarm : Color.textSecondary.opacity(0.4))
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityLabel("Send message")
        }
        .padding(.horizontal, Spacing.m)
        .padding(.vertical, Spacing.s)
        .background(Color.appBackground)
    }
}

// MARK: - Previews

#Preview("Conversation") {
    ChatViewPreview(chatId: "demo-chat-01", kind: .text, title: "Processing the week")
}

#Preview("Voice transcript (read-only)") {
    ChatViewPreview(chatId: "demo-chat-02", kind: .voice, title: "Evening check-in call")
}

#Preview("Fresh chat + greeting") {
    ChatViewPreview(chatId: "new-chat", kind: .text, title: "New chat", seedEmptyChat: true)
}

#Preview("Streaming") {
    ChatViewPreview(
        chatId: "demo-chat-01",
        kind: .text,
        title: "Processing the week",
        previewState: { vm in
            vm.setPreviewState(streamingReply: "Reading back through your recent entries, I notice you tend to move forward fastest when")
        }
    )
}

#Preview("Awaiting first token") {
    ChatViewPreview(
        chatId: "demo-chat-01",
        kind: .text,
        title: "Processing the week",
        previewState: { vm in
            vm.setPreviewState(isAwaitingFirstToken: true)
        }
    )
}

#Preview("Failed send") {
    ChatViewPreview(
        chatId: "demo-chat-01",
        kind: .text,
        title: "Processing the week",
        previewState: { vm in
            vm.setPreviewState(
                failedSend: .init(
                    message: ChatMessage(role: .user, text: "Can you help me plan tomorrow?"),
                    isPersisted: false
                )
            )
        }
    )
}

#Preview("Dark") {
    ChatViewPreview(chatId: "demo-chat-01", kind: .text, title: "Processing the week")
        .preferredColorScheme(.dark)
}

private struct ChatViewPreview: View {

    let chatId: String
    let kind: ChatKind
    let title: String
    var seedEmptyChat = false
    var previewState: ((ChatViewModel) -> Void)? = nil

    var body: some View {
        NavigationStack {
            ChatView(previewViewModel: makeViewModel())
        }
    }

    private func makeViewModel() -> ChatViewModel {
        let repository = seedEmptyChat
            ? MockChatRepository(
                chats: [Chat(id: chatId, userId: MockData.userId, title: title)],
                messages: [chatId: []]
            )
            : MockChatRepository()
        let viewModel = ChatViewModel(
            chatId: chatId,
            kind: kind,
            title: title,
            chats: repository,
            ai: MockAIService(),
            speech: MockSpeechTranscriber()
        )
        previewState?(viewModel)
        return viewModel
    }
}
