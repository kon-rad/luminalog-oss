import SwiftUI

/// Root navigation shell: switches between the four tabs above the custom
/// bottom bar, presents the Create flow from the raised "+" button, and
/// hides the bar while the keyboard is visible.
struct RootView: View {

    @State private var selectedTab: AppTab = .home
    @State private var isPresentingCreate = false
    @State private var isKeyboardVisible = false

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            // Placeholder feature views — replaced by Tasks 4–9.
            // All tabs stay mounted so scroll positions and NavigationStack
            // paths survive tab switches; only the selected one is visible.
            tabContent(for: .home) {
                TabPlaceholder(title: "Home", systemImage: "house")
            }
            tabContent(for: .journal) {
                TabPlaceholder(title: "Journal", systemImage: "book")
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
                    isPresentingCreate = true
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
        .fullScreenCover(isPresented: $isPresentingCreate) {
            CreatePlaceholderView()
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

// MARK: - Placeholders (replaced by Tasks 4–9)

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

/// Full-screen placeholder for the Create flow (built in Task 7).
private struct CreatePlaceholderView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: Spacing.m) {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(Color.accentWarm.opacity(0.8))
                Text("Create — coming in Task 7")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.textSecondary)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color.secondaryBackground))
            }
            .buttonStyle(.plain)
            .padding(Spacing.m)
            .accessibilityLabel("Close")
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
}

#Preview("Dark") {
    RootView()
        .preferredColorScheme(.dark)
}
