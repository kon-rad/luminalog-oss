import SwiftUI
import UIKit

// MARK: - Tabs

/// The four selectable tabs. The center "+" is an action, not a tab.
enum AppTab: String, CaseIterable, Identifiable {
    case home
    case journal
    case chats
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Home"
        case .journal: return "Journal"
        case .chats: return "Chats"
        case .profile: return "Profile"
        }
    }

    var systemImage: String {
        switch self {
        case .home: return "house"
        case .journal: return "book"
        case .chats: return "bubble.left.and.bubble.right"
        case .profile: return "person"
        }
    }
}

// MARK: - Tab bar

/// Custom bottom navigation bar (design §1): four tabs plus a raised
/// circular "+" create button whose center sits on the bar's top edge.
struct AppTabBar: View {

    @Binding var selectedTab: AppTab
    var onCreateTapped: () -> Void

    /// Height of the bar's content area (above the home-indicator inset).
    private static let barHeight: CGFloat = 56
    /// Diameter of the raised create button.
    private static let createButtonSize: CGFloat = 64

    var body: some View {
        HStack(spacing: 0) {
            tabButton(.home)
            tabButton(.journal)
            createButton
            tabButton(.chats)
            tabButton(.profile)
        }
        .frame(height: Self.barHeight)
        .frame(maxWidth: .infinity)
        .background(alignment: .top) {
            barBackground
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isTabBar)
    }

    // MARK: Pieces

    private var barBackground: some View {
        Rectangle()
            .fill(.regularMaterial)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Color.primary.opacity(0.06))
                    .frame(height: 0.5)
            }
            .ignoresSafeArea(edges: .bottom)
    }

    private func tabButton(_ tab: AppTab) -> some View {
        let isSelected = selectedTab == tab
        return Button {
            selectedTab = tab
        } label: {
            VStack(spacing: Spacing.xs) {
                Image(systemName: tab.systemImage)
                    .font(.system(size: 22, weight: isSelected ? .semibold : .regular))
                    .symbolVariant(isSelected ? .fill : .none)
                Text(tab.title)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
            }
            .foregroundStyle(isSelected ? Color.accentWarm : Color.textSecondary)
            .frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        .accessibilityShowsLargeContentViewer {
            Label(tab.title, systemImage: tab.systemImage)
        }
    }

    /// Raised circular "+" — vertically offset so its center sits on the
    /// bar's top edge (half the circle rises above the bar).
    private var createButton: some View {
        Button(action: onCreateTapped) {
            ZStack {
                // Background ring in the app background color separates the
                // FAB from the blurred bar below (matches design nav.jsx outline).
                Circle()
                    .fill(Color.appBackground)
                    .frame(width: Self.createButtonSize + 8, height: Self.createButtonSize + 8)

                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.accentWarm, Color.accentWarm.opacity(0.8)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: Self.createButtonSize, height: Self.createButtonSize)
                    .shadow(color: Color.accentWarm.opacity(0.4), radius: 10, y: 4)

                Image(systemName: "plus")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .offset(y: -Self.barHeight / 2)
        .accessibilityLabel("Create journal entry")
        .accessibilityShowsLargeContentViewer {
            Label("Create journal entry", systemImage: "plus")
        }
    }
}

// MARK: - Keyboard observation

/// Tracks keyboard visibility so the tab bar can hide while typing.
struct KeyboardVisibilityModifier: ViewModifier {

    @Binding var isKeyboardVisible: Bool

    func body(content: Content) -> some View {
        content
            .onReceive(
                NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)
            ) { _ in
                withAnimation(.easeOut(duration: 0.2)) { isKeyboardVisible = true }
            }
            .onReceive(
                NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)
            ) { _ in
                withAnimation(.easeOut(duration: 0.2)) { isKeyboardVisible = false }
            }
    }
}

extension View {
    /// Binds keyboard visibility to the given state.
    func observingKeyboard(isVisible: Binding<Bool>) -> some View {
        modifier(KeyboardVisibilityModifier(isKeyboardVisible: isVisible))
    }
}

// MARK: - Previews

#Preview("Light") {
    StatefulTabBarPreview()
}

#Preview("Dark") {
    StatefulTabBarPreview()
        .preferredColorScheme(.dark)
}

private struct StatefulTabBarPreview: View {
    @State private var tab: AppTab = .home

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            Text("Selected: \(tab.title)")
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            AppTabBar(selectedTab: $tab, onCreateTapped: {})
        }
    }
}
