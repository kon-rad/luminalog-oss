import SwiftUI

/// Root navigation shell: switches between the four tabs above the custom
/// bottom bar, presents the Create flow from the raised "+" button, and
/// hides the bar while the keyboard is visible.
struct RootView: View {

    @EnvironmentObject private var services: AppServices

    @State private var selectedTab: AppTab = .home
    @State private var createRequest: CreateEntryRequest?
    @State private var isKeyboardVisible = false

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
                    speech: services.speech,
                    onStartJournaling: { prompt in
                        createRequest = CreateEntryRequest(promptText: prompt)
                    },
                    onShowMore: {
                        selectedTab = .journal
                    },
                    onPrompt: { request in
                        createRequest = request
                    }
                )
            }
            tabContent(for: .journal) {
                JournalListView(
                    journals: services.journals,
                    ai: services.ai,
                    media: services.media,
                    speech: services.speech,
                    onPrompt: { request in
                        createRequest = request
                    }
                )
            }
            tabContent(for: .chats) {
                ChatListView(
                    chats: services.chats,
                    ai: services.ai,
                    speech: services.speech,
                    voice: services.voice
                )
            }
            tabContent(for: .profile) {
                ProfileView(
                    auth: services.auth,
                    profiles: services.profiles,
                    subscriptions: services.subscriptions,
                    media: services.media
                )
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !isKeyboardVisible {
                AppTabBar(selectedTab: $selectedTab) {
                    createRequest = CreateEntryRequest()
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .observingKeyboard(isVisible: $isKeyboardVisible)
        .fullScreenCover(item: $createRequest) { request in
            CreateEntryView(request: request, services: services)
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
