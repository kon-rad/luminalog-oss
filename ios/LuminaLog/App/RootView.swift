import SwiftUI

/// Root navigation shell: switches between the four tabs above the custom
/// bottom bar, presents the Create flow from the raised "+" button, and
/// hides the bar while the keyboard is visible.
struct RootView: View {

    @EnvironmentObject private var services: AppServices

    /// Lets full-screen children (the chat conversation) hide the tab bar.
    @StateObject private var chrome = AppChrome()

    /// Re-arms the smart daily reminder on goal progress, foreground, settings.
    @StateObject private var reminders = ReminderCoordinator()
    @Environment(\.scenePhase) private var scenePhase

    @State private var selectedTab: AppTab = .home
    @State private var createRequest: CreateEntryRequest?
    @State private var isKeyboardVisible = false
    /// Latest profile snapshot, used to re-arm the reminder on scene-active.
    @State private var latestProfile: UserProfile?

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            // All tabs stay mounted so scroll positions and NavigationStack
            // paths survive tab switches; only the selected one is visible.
            tabContent(for: .home) {
                HomeView(
                    journals: services.journals,
                    profiles: services.profiles,
                    ai: services.ai,
                    media: services.media,
                    onStartJournaling: { prompt in
                        createRequest = CreateEntryRequest(promptText: prompt)
                    },
                    onShowMore: {
                        selectedTab = .journal
                    },
                    onPrompt: { request in
                        createRequest = request
                    },
                    onRetryProcessing: { services.entryProcessor.retry(draftId: $0) }
                )
            }
            tabContent(for: .journal) {
                JournalListView(
                    journals: services.journals,
                    ai: services.ai,
                    media: services.media,
                    onPrompt: { request in
                        createRequest = request
                    },
                    onRetryProcessing: { services.entryProcessor.retry(draftId: $0) }
                )
            }
            tabContent(for: .chats) {
                ChatListView(
                    chats: services.chats,
                    ai: services.ai,
                    speech: services.speech,
                    voice: services.voice,
                    credits: services.credits,
                    api: services.api,
                    journals: services.journals,
                    media: services.media
                )
            }
            tabContent(for: .profile) {
                ProfileView(
                    auth: services.auth,
                    profiles: services.profiles,
                    subscriptions: services.subscriptions,
                    credits: services.credits,
                    media: services.media,
                    reminders: reminders
                )
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !isKeyboardVisible && !chrome.tabBarHidden {
                AppTabBar(selectedTab: $selectedTab) {
                    createRequest = CreateEntryRequest()
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .environmentObject(chrome)
        .environmentObject(reminders)
        .observingKeyboard(isVisible: $isKeyboardVisible)
        .fullScreenCover(item: $createRequest) { request in
            CreateEntryView(request: request, services: services)
        }
        .task {
            // Re-arm whenever the profile changes (goal progress, timezone).
            for await profile in services.profiles.profile() {
                latestProfile = profile
                await reminders.refresh(profile: profile)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Self-heal after a fired notification or a day rollover.
            if phase == .active {
                Task { await reminders.refresh(profile: latestProfile) }
            }
        }
    }

    /// Keeps a tab's view in the hierarchy while hiding it when unselected,
    /// preserving per-tab state (scroll offsets, navigation paths).
    @ViewBuilder
    private func tabContent<Content: View>(
        for tab: AppTab,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let isSelected = selectedTab == tab
        content()
            .opacity(isSelected ? 1 : 0)
            .allowsHitTesting(isSelected)
            .accessibilityHidden(!isSelected)
    }
}

// MARK: - Previews

#Preview("Light") {
    RootView()
        .environmentObject(AppServices.mocks())
}

#Preview("Dark") {
    RootView()
        .environmentObject(AppServices.mocks())
        .preferredColorScheme(.dark)
}
