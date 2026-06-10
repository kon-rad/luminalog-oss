import SwiftUI

/// Compact stat card — value, label, optional SF Symbol.
/// Used side-by-side on Home for streak and word count (design §2).
struct StatCard: View {

    let value: String
    let label: String
    var systemImage: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(spacing: Spacing.s) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Color.accentWarm)
                }
                Text(value)
                    .font(.statValue)
                    .foregroundStyle(Color.textPrimary)
            }

            Text(label)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label)")
    }
}

// MARK: - Previews

#Preview("Light") {
    StatCardPreview()
}

#Preview("Dark") {
    StatCardPreview()
        .preferredColorScheme(.dark)
}

private struct StatCardPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            HStack(spacing: Spacing.m) {
                StatCard(
                    value: "\(MockData.profile.stats.streakCount)-day",
                    label: "streak",
                    systemImage: "flame"
                )
                StatCard(
                    value: MockData.profile.stats.totalWords.formatted(),
                    label: "words in your journal"
                )
            }
            .padding()
        }
    }
}
