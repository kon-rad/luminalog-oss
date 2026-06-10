import SwiftUI

/// The three Journal Detail tabs (design §4).
enum JournalDetailTab: String, CaseIterable, Identifiable {
    case main = "Main"
    case insights = "Insights"
    case prompts = "Prompts"

    var id: String { rawValue }
}

/// Underline-style segmented control for the detail tabs — selected segment
/// gets primary text and a warm accent underline that slides between tabs.
struct DetailTabBar: View {

    @Binding var selection: JournalDetailTab

    @Namespace private var underlineNamespace

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(JournalDetailTab.allCases) { tab in
                    segment(for: tab)
                }
            }

            Divider()
                .overlay(Color.textSecondary.opacity(0.2))
        }
        .background(Color.appBackground)
    }

    private func segment(for tab: JournalDetailTab) -> some View {
        let isSelected = selection == tab
        return Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                selection = tab
            }
        } label: {
            VStack(spacing: Spacing.s) {
                Text(tab.rawValue)
                    .font(.uiBody.weight(isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? Color.textPrimary : Color.textSecondary)

                ZStack {
                    Color.clear
                        .frame(height: 3)
                    if isSelected {
                        Capsule()
                            .fill(Color.accentWarm)
                            .frame(height: 3)
                            .matchedGeometryEffect(id: "underline", in: underlineNamespace)
                    }
                }
            }
            .padding(.top, Spacing.s)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(tab.rawValue) tab")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

// MARK: - Previews

#Preview("Light") {
    DetailTabBarPreview()
}

#Preview("Dark") {
    DetailTabBarPreview()
        .preferredColorScheme(.dark)
}

private struct DetailTabBarPreview: View {
    @State private var selection: JournalDetailTab = .main

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            DetailTabBar(selection: $selection)
        }
    }
}
