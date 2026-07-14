import SwiftUI

/// Route into one conversation (text chat or voice transcript).
struct ChatRoute: Hashable {
    let chatId: String
    let kind: ChatKind
    let title: String
    let journalTitle: String?

    init(chat: Chat) {
        chatId = chat.id
        kind = chat.kind
        title = chat.title.isEmpty ? "New chat" : chat.title
        journalTitle = chat.journalTitle
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
    /// Used by the voice-call detail view to fetch a signed recording URL.
    /// Optional so previews/mocks can omit it (audio then shows as unavailable).
    private let api: ProxyAPIClient?
    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let media: MediaUploader
    private let voiceRecordingImporter: VoiceRecordingImporter?

    @State private var path = NavigationPath()
    @State private var isVoiceCallPresented = false
    @State private var isCreditsPresented = false
    @State private var pendingVoiceJournalId: String? = nil
    @State private var pendingVoiceJournalTitle: String? = nil

    init(
        chats: ChatRepository,
        ai: AIService,
        speech: SpeechTranscriber,
        voice: VoiceCallService,
        credits: CreditService,
        api: ProxyAPIClient? = nil,
        journals: JournalRepository,
        profiles: ProfileRepository,
        media: MediaUploader,
        voiceRecordingImporter: VoiceRecordingImporter? = nil
    ) {
        _viewModel = StateObject(wrappedValue: ChatListViewModel(chats: chats))
        self.chats = chats
        self.ai = ai
        self.speech = speech
        self.voice = voice
        self.credits = credits
        self.api = api
        self.journals = journals
        self.profiles = profiles
        self.media = media
        self.voiceRecordingImporter = voiceRecordingImporter
    }

    var body: some View {
        NavigationStack(path: $path) {
            content
                .overlay(alignment: .bottomTrailing) {
                    // The empty state surfaces its own centered start buttons, so
                    // the floating actions only appear once conversations exist.
                    if !(viewModel.hasLoaded && viewModel.chats.isEmpty) {
                        floatingActions
                    }
                }
                .background(Color.appBackground.ignoresSafeArea())
                .navigationTitle("Chats")
                .navigationDestination(for: ChatRoute.self) { route in
                    if route.kind == .voice {
                        VoiceCallDetailView(chatId: route.chatId, repository: chats, media: media, importer: voiceRecordingImporter)
                    } else {
                        ChatView(
                            chatId: route.chatId,
                            kind: route.kind,
                            title: route.title,
                            journalTitle: route.journalTitle,
                            chats: chats,
                            ai: ai,
                            speech: speech
                        )
                    }
                }
                .navigationDestination(for: JournalDetailRoute.self) { route in
                    JournalDetailView(
                        entryId: route.entryId,
                        journals: journals,
                        profiles: profiles,
                        ai: ai,
                        media: media,
                        onPrompt: { _ in },
                        onStartJournalChat: { journalId, journalTitle, kind in
                            if kind == .voice {
                                pendingVoiceJournalId = journalId
                                pendingVoiceJournalTitle = journalTitle
                                isVoiceCallPresented = true
                            } else {
                                Task {
                                    guard let chat = await viewModel.startTextChat(journalId: journalId, journalTitle: journalTitle) else { return }
                                    path.append(ChatRoute(chat: chat))
                                }
                            }
                        }
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
        .fullScreenCover(isPresented: $isVoiceCallPresented, onDismiss: {
            pendingVoiceJournalId = nil
            pendingVoiceJournalTitle = nil
        }) {
            VoiceCallView(
                voice: voice,
                chats: chats,
                credits: credits,
                journalId: pendingVoiceJournalId,
                journalTitle: pendingVoiceJournalTitle,
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
        .contentMargins(.bottom, AppTabBar.scrollBottomPadding, for: .scrollContent)
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
        .contentMargins(.bottom, AppTabBar.scrollBottomPadding, for: .scrollContent)
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

    /// Two stacked floating action buttons (bottom-right), hovering above the
    /// root tab bar: a primary "New chat" (text) and a secondary "New call"
    /// (voice). Replaces the old top-right compose menu.
    private var floatingActions: some View {
        VStack(alignment: .trailing, spacing: Spacing.s) {
            fabButton(
                title: "New chat",
                systemImage: "square.and.pencil",
                prominent: true,
                action: { Task { await startTextChat() } }
            )
            fabButton(
                title: "New call",
                systemImage: "phone.fill",
                prominent: false,
                action: { isVoiceCallPresented = true }
            )
        }
        .padding(.trailing, Spacing.m)
        // Clear the root tab bar (and its raised "+"): the safe-area inset from
        // RootView doesn't propagate into this NavigationStack, so lift the FABs
        // by the same constant scroll views use, plus a small gap.
        .padding(.bottom, AppTabBar.scrollBottomPadding + Spacing.s)
    }

    private func fabButton(
        title: String,
        systemImage: String,
        prominent: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(prominent ? Color.white : Color.accentWarm)
                .padding(.horizontal, Spacing.l)
                .padding(.vertical, Spacing.s + 4)
                .background(
                    Capsule(style: .continuous)
                        .fill(prominent ? Color.accentWarm : Color.cardBackground)
                )
                .overlay(
                    Capsule(style: .continuous)
                        .strokeBorder(
                            prominent ? Color.clear : Color.accentWarm.opacity(0.35),
                            lineWidth: 1
                        )
                )
                .shadow(color: Color.black.opacity(0.18), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
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
                if let journalTitle = chat.journalTitle, !journalTitle.isEmpty,
                   let journalId = chat.journalId {
                    NavigationLink(value: JournalDetailRoute(entryId: journalId)) {
                        Label(journalTitle, systemImage: "book.closed")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.accentWarm)
                            .lineLimit(1)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(Color.accentWarm.opacity(0.12))
                            )
                    }
                    .buttonStyle(.plain)
                }
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
            credits: MockCreditService(),
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(),
            media: MockMediaUploader()
        )
        .environmentObject(AppChrome())
    }
}
