import SwiftUI

/// Prompt card — the hero daily-prompt treatment on Home (design §2)
/// and the compact list-item treatment on the Prompts tab (design §4).
struct PromptCard: View {

    enum Variant {
        /// Large card with a prominent CTA button.
        case hero(actionTitle: String)
        /// Compact row with a trailing "→" button.
        case listItem
    }

    let question: String
    let variant: Variant
    let action: () -> Void

    /// Hero daily-prompt card with a CTA button.
    static func hero(
        question: String,
        actionTitle: String,
        action: @escaping () -> Void
    ) -> PromptCard {
        PromptCard(question: question, variant: .hero(actionTitle: actionTitle), action: action)
    }

    /// Compact prompt row with a trailing "→" button (Prompts tab).
    static func listItem(
        question: String,
        action: @escaping () -> Void
    ) -> PromptCard {
        PromptCard(question: question, variant: .listItem, action: action)
    }

    var body: some View {
        switch variant {
        case .hero(let actionTitle):
            heroBody(actionTitle: actionTitle)
        case .listItem:
            listItemBody
        }
    }

    // MARK: Hero

    private func heroBody(actionTitle: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            Text("\u{201C}\(question)\u{201D}")
                .font(.promptQuote)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Button(action: action) {
                Text(actionTitle)
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(
                        RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                            .fill(Color.accentWarm)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(Spacing.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.xLarge, style: .continuous)
                .fill(Color.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.xLarge, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.accentWarm.opacity(0.20),
                                    Color.accentWarm.opacity(0.04),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
        )
    }

    // MARK: List item

    private var listItemBody: some View {
        HStack(alignment: .center, spacing: Spacing.m) {
            Text("\u{201C}\(question)\u{201D}")
                .font(.system(.body, design: .serif).italic())
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: action) {
                Image(systemName: "arrow.right")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.accentWarm)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color.accentWarm.opacity(0.15)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Journal about this prompt")
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }
}

// MARK: - Previews

#Preview("Light") {
    PromptCardPreview()
}

#Preview("Dark") {
    PromptCardPreview()
        .preferredColorScheme(.dark)
}

private struct PromptCardPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ScrollView {
                VStack(spacing: Spacing.m) {
                    PromptCard.hero(
                        question: MockData.profile.dailyPrompt?.text ?? MockData.cannedDailyPrompt,
                        actionTitle: "Start Journaling",
                        action: {}
                    )
                    ForEach(MockData.cannedPrompts.prefix(3), id: \.self) { prompt in
                        PromptCard.listItem(question: prompt, action: {})
                    }
                }
                .padding()
            }
        }
    }
}
