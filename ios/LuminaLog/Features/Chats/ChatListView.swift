import SwiftUI

/// Route into one conversation (text chat or voice transcript).
struct ChatRoute: Hashable {
    let chatId: String
    let kind: ChatKind
    let title: String

    init(chat: Chat) {
        chatId = chat.id
        kind = chat.kind
        title = chat.title.isEmpty ? "New chat" : chat.title
    }
}

/// Chats tab (design §6): history of conversations with the AI companion,
/// a new-chat menu (text or voice), and swipe-to-delete.
struct ChatListView: View {

    @StateObject private var viewModel: ChatListViewModel

    /// Controls the root tab bar — hidden while any conversation is open.
    @EnvironmentObject private var chrome: AppChrome

    // Retained for navigation destinations and the voice call screen.
    private let chats: ChatRepository
    private let ai: AIService
    private let speech: SpeechTranscriber
    private let voice: VoiceCallService
    private let credits: CreditService

    @State private var path: [ChatRoute] = []
    @State private var isVoiceCallPresented = false
    @State private var isCreditsPresented = false

    init(
        chats: ChatRepository,
        ai: AIService,
        speech: SpeechTranscriber,
        voice: VoiceCallService,
        credits: CreditService
    ) {
        _viewModel = StateObject(wrappedValue: ChatListViewModel(chats: chats))
        self.chats = chats
        self.ai = ai
        self.speech = speech
        self.voice = voice
        self.credits = credits
    }

    var body: some View {
        NavigationStack(path: $path) {
            content
                .background(Color.appBackground.ignoresSafeArea())
                .navigationTitle("Chats")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        newChatMenu
                    }
                }
                .navigationDestination(for: ChatRoute.self) { route in
                    ChatView(
                        chatId: route.chatId,
                        kind: route.kind,
                        title: route.title,
                        chats: chats,
                        ai: ai,
                        speech: speech
                    )
                }
        }
        .task {
            await viewModel.start()
        }
        .onChange(of: path.isEmpty) { _, isEmpty in
            withAnimation(.easeOut(duration: 0.2)) {
                chrome.tabBarHidden = !isEmpty
            }
        }
        .onDisappear {
            chrome.tabBarHidden = false
        }
        .fullScreenCover(isPresented: $isVoiceCallPresented) {
            VoiceCallView(
                voice: voice,
                chats: chats,
                credits: credits,
                onViewTranscript: { chat in
                    isVoiceCallPresented = false
                    path.append(ChatRoute(chat: chat))
                },
                onInsufficientCredits: {
                    isCreditsPresented = true
                }
            )
        }
        .sheet(isPresented: $isCreditsPresented) {
            CreditsView(credits: credits)
        }
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        if !viewModel.hasLoaded {
            skeletonList
        } else if viewModel.chats.isEmpty {
            emptyState
        } else {
            chatList
        }
    }

    private var chatList: some View {
        List {
            ForEach(viewModel.chats) { chat in
                NavigationLink(value: ChatRoute(chat: chat)) {
                    ChatRow(chat: chat)
                }
                .listRowBackground(Color.appBackground)
                .listRowSeparatorTint(Color.textSecondary.opacity(0.15))
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        Task { await viewModel.delete(chat) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    private var skeletonList: some View {
        List {
            ForEach(0..<4, id: \.self) { _ in
                ChatRow(chat: .skeletonPlaceholder)
                    .redacted(reason: .placeholder)
                    .listRowBackground(Color.appBackground)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .accessibilityHidden(true)
    }

    /// Empty state per design §6: "Talk to your journal" with both start
    /// options surfaced as buttons.
    private var emptyState: some View {
        VStack(spacing: Spacing.m) {
            EmptyStateView(
                systemImage: "bubble.left.and.bubble.right",
                title: "Talk to your journal",
                message: "Your companion has been reading along. Start a conversation about anything on your mind — by text or voice."
            )

            VStack(spacing: Spacing.s) {
                startButton(
                    title: "Start Text Chat",
                    systemImage: "bubble.left.and.text.bubble.right",
                    prominent: true,
                    action: { Task { await startTextChat() } }
                )
                startButton(
                    title: "Start Voice Chat",
                    systemImage: "waveform",
                    prominent: false,
                    action: { isVoiceCallPresented = true }
                )
            }
            .padding(.horizontal, Spacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    private func startButton(
        title: String,
        systemImage: String,
        prominent: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(prominent ? Color.white : Color.accentWarm)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                        .fill(prominent ? Color.accentWarm : Color.accentWarm.opacity(0.15))
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - New chat

    private var newChatMenu: some View {
        Menu {
            Button {
                Task { await startTextChat() }
            } label: {
                Label("Start Text Chat", systemImage: "bubble.left.and.text.bubble.right")
            }
            Button {
                isVoiceCallPresented = true
            } label: {
                Label("Start Voice Chat", systemImage: "waveform")
            }
        } label: {
            Image(systemName: "square.and.pencil")
                .foregroundStyle(Color.accentWarm)
        }
        .accessibilityLabel("New chat")
    }

    private func startTextChat() async {
        guard let chat = await viewModel.startTextChat() else { return }
        path.append(ChatRoute(chat: chat))
    }
}

// MARK: - Row

/// One conversation row: kind icon, title, relative time of last activity.
private struct ChatRow: View {

    let chat: Chat

    private var isVoice: Bool { chat.kind == .voice }

    var body: some View {
        HStack(spacing: Spacing.m) {
            Image(systemName: isVoice ? "waveform" : "bubble.left")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(isVoice ? Color.tintVoice : Color.accentWarm)
                .frame(width: 40, height: 40)
                .background(
                    Circle().fill((isVoice ? Color.tintVoice : Color.accentWarm).opacity(0.14))
                )

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(chat.title.isEmpty ? "New chat" : chat.title)
                    .font(.uiBody.weight(.medium))
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                Text(isVoice ? "Voice call" : "Text chat")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer()

            Text(chat.lastMessageAt.formatted(.relative(presentation: .named)))
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(.vertical, Spacing.xs)
        .accessibilityElement(children: .combine)
    }
}

private extension Chat {
    static var skeletonPlaceholder: Chat {
        Chat(userId: "skeleton", kind: .text, title: "Placeholder chat title")
    }
}

// MARK: - Previews

#Preview("Default") {
    ChatListPreview()
}

#Preview("Empty") {
    ChatListPreview(chats: [], messages: [:])
}

#Preview("Dark") {
    ChatListPreview()
        .preferredColorScheme(.dark)
}

private struct ChatListPreview: View {
    var chats: [Chat] = MockData.chats
    var messages: [String: [ChatMessage]] = MockData.chatMessages

    var body: some View {
        let repository = MockChatRepository(chats: chats, messages: messages)
        ChatListView(
            chats: repository,
            ai: MockAIService(),
            speech: MockSpeechTranscriber(),
            voice: MockVoiceCallService(chats: repository),
            credits: MockCreditService()
        )
        .environmentObject(AppChrome())
    }
}
