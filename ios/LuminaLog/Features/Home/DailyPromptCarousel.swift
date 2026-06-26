import SwiftUI

/// Accumulates the maximum natural card height across all measurement passes.
private struct CardHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

/// The daily-prompt hero on Home: a swipeable carousel of five area-anchored
/// prompts (design §2). Each page shows the life-area chip and its personalized
/// question; below sit ◀ / ▶ arrows, page dots (current highlighted), and a
/// single "Start Journaling" button that seeds the Create flow with the
/// currently visible prompt.
struct DailyPromptCarousel: View {

    let prompts: [DailyPromptItem]
    /// Invoked with the visible prompt when "Start Journaling" is tapped.
    let onStart: (DailyPromptItem) -> Void

    @State private var selection = 0
    /// Measured from the tallest card's natural content height; drives the TabView frame.
    @State private var cardHeight: CGFloat = 160

    private var clampedSelection: Int { min(max(selection, 0), prompts.count - 1) }
    private var current: DailyPromptItem { prompts[clampedSelection] }

    var body: some View {
        VStack(spacing: Spacing.m) {
            TabView(selection: $selection) {
                ForEach(Array(prompts.enumerated()), id: \.offset) { index, prompt in
                    card(prompt)
                        .padding(.horizontal, 2) // breathing room so shadows aren't clipped
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: cardHeight)
            .animation(.easeInOut(duration: 0.25), value: selection)
            // Invisible sizer: renders all cards at natural height to find the tallest.
            // Uses .background so it doesn't affect the TabView's own layout.
            .background(
                ZStack {
                    ForEach(Array(prompts.enumerated()), id: \.offset) { _, prompt in
                        sizeCard(prompt)
                    }
                }
                .opacity(0)
                .allowsHitTesting(false)
            )

            controls

            startButton
        }
        .onPreferenceChange(CardHeightKey.self) { h in
            if h > 0 { cardHeight = h }
        }
    }

    // MARK: - Card

    private func card(_ prompt: DailyPromptItem) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text(prompt.area)
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
                .textCase(.uppercase)
                .kerning(1.2)

            Text("\u{201C}\(prompt.text)\u{201D}")
                .font(.promptQuote)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
        .padding(Spacing.l)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(prompt.area) prompt: \(prompt.text)")
    }

    /// Renders card content at its natural height (no Spacer/maxHeight fill) so
    /// a GeometryReader can report the true content height to `CardHeightKey`.
    private func sizeCard(_ prompt: DailyPromptItem) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text(prompt.area)
                .font(.captionText.weight(.semibold))
                .kerning(1.2)
            Text("\u{201C}\(prompt.text)\u{201D}")
                .font(.promptQuote)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.l)
        .padding(.horizontal, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            GeometryReader { geo in
                Color.clear.preference(key: CardHeightKey.self, value: geo.size.height)
            }
        )
    }

    // MARK: - Controls (arrows + dots)

    private var controls: some View {
        HStack(spacing: Spacing.m) {
            arrowButton(
                systemName: "chevron.left",
                label: "Previous prompt",
                enabled: clampedSelection > 0
            ) { step(-1) }

            dots

            arrowButton(
                systemName: "chevron.right",
                label: "Next prompt",
                enabled: clampedSelection < prompts.count - 1
            ) { step(1) }
        }
        .frame(maxWidth: .infinity)
    }

    private var dots: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(prompts.indices, id: \.self) { index in
                Circle()
                    .fill(index == clampedSelection ? Color.accentWarm : Color.textSecondary.opacity(0.3))
                    .frame(width: index == clampedSelection ? 9 : 7,
                           height: index == clampedSelection ? 9 : 7)
                    .animation(.easeInOut(duration: 0.2), value: clampedSelection)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement()
        .accessibilityLabel("Prompt \(clampedSelection + 1) of \(prompts.count)")
    }

    private func arrowButton(
        systemName: String,
        label: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(enabled ? Color.accentWarm : Color.textSecondary.opacity(0.35))
                .frame(width: 44, height: 44)
                .background(
                    Circle().fill(Color.accentWarm.opacity(enabled ? 0.15 : 0.06))
                )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    // MARK: - Start button

    private var startButton: some View {
        Button { onStart(current) } label: {
            Text("Start Journaling")
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                        .fill(Color.accentWarm)
                )
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens a new entry seeded with the \(current.area) prompt")
    }

    // MARK: - Paging

    private func step(_ delta: Int) {
        let next = clampedSelection + delta
        guard next >= 0, next < prompts.count else { return }
        withAnimation(.easeInOut(duration: 0.25)) { selection = next }
    }
}

// MARK: - Previews

#Preview("Light") {
    DailyPromptCarouselPreview()
}

#Preview("Dark") {
    DailyPromptCarouselPreview()
        .preferredColorScheme(.dark)
}

private struct DailyPromptCarouselPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            DailyPromptCarousel(prompts: MockData.cannedDailyPrompts, onStart: { _ in })
                .padding()
        }
    }
}
