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
            // Chats/Profile placeholders are replaced by Tasks 8–9.
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
                    }
                )
            }
            tabContent(for: .journal) {
                JournalListView(
                    journals: services.journals,
                    ai: services.ai,
                    media: services.media,
                    onPrompt: { request in
                        createRequest = request
                    }
                )
            }
            tabContent(for: .chats) {
                TabPlaceholder(title: "Chats", systemImage: "bubble.left.and.bubble.right")
            }
            tabContent(for: .profile) {
                TabPlaceholder(title: "Profile", systemImage: "person")
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
        .overlay(alignment: .top) {
            if !AppConfig.isFirebaseConfigured {
                DemoModeChip()
            }
        }
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

// MARK: - Placeholders (replaced by Tasks 6–9)

private struct TabPlaceholder: View {
    let title: String
    let systemImage: String

    var body: some View {
        VStack(spacing: Spacing.m) {
            Image(systemName: systemImage)
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Color.accentWarm.opacity(0.8))
            Text(title)
                .font(.journalTitle)
                .foregroundStyle(Color.textPrimary)
            Text("Coming soon.")
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
        }
    }
}

/// Small chip shown when running without a Firebase configuration.
private struct DemoModeChip: View {
    var body: some View {
        Text("Demo Mode")
            .font(.captionText.weight(.semibold))
            .foregroundStyle(Color.accentWarm)
            .padding(.horizontal, Spacing.m)
            .padding(.vertical, Spacing.xs)
            .background(Capsule().fill(Color.accentWarm.opacity(0.15)))
            .padding(.top, Spacing.xs)
            .accessibilityLabel("Running in demo mode")
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
