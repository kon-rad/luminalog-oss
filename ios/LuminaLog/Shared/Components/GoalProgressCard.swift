import SwiftUI

/// Today's progress toward the daily journaling goal (design §2): a labeled
/// progress bar with a "X words to go" / "Goal met" trailing label.
struct GoalProgressCard: View {

    let current: Int
    let target: Int
    let fraction: Double
    let label: String
    let isMet: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack {
                HStack(spacing: Spacing.s) {
                    Image(systemName: isMet ? "checkmark.seal.fill" : "book.pages")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.accentWarm)
                    Text("Today's pages")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                }
                Spacer()
                Text("\(current)/\(target)")
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.textSecondary)
            }

            ProgressView(value: fraction)
                .tint(Color.accentWarm)

            Text(label)
                .font(.captionText)
                .foregroundStyle(isMet ? Color.accentWarm : Color.textSecondary)
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Today's journaling: \(current) of \(target) words. \(label).")
    }
}

#Preview("In progress") {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        GoalProgressCard(current: 300, target: 750, fraction: 0.4, label: "450 words to go", isMet: false)
            .padding()
    }
}

#Preview("Met") {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        GoalProgressCard(current: 800, target: 750, fraction: 1, label: "Goal met", isMet: true)
            .padding()
    }
}
