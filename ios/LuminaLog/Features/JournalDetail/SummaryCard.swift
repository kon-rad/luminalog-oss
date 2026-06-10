import SwiftUI

/// Expandable AI summary card on the Main tab (design §4): collapsed to
/// three lines, tap to expand. Shows a "Regenerate" affordance only when the
/// entry was edited after the summary was generated, with a regenerating
/// state while the new summary is in flight.
struct SummaryCard: View {

    let text: String
    /// True when `contentEditedAt > summary.generatedAt`.
    let showsRegenerate: Bool
    let isRegenerating: Bool
    let onRegenerate: () -> Void

    @State private var isExpanded = false

    private static let collapsedLineLimit = 3

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            header

            Text(text)
                .font(.journalBody)
                .foregroundStyle(Color.textPrimary.opacity(isRegenerating ? 0.5 : 1))
                .lineSpacing(3)
                .lineLimit(isExpanded ? nil : Self.collapsedLineLimit)
                .fixedSize(horizontal: false, vertical: true)

            if showsRegenerate || isRegenerating {
                regenerateRow
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .strokeBorder(Color.accentWarm.opacity(0.25))
                )
        )
        .contentShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
        .onTapGesture {
            withAnimation(.easeInOut(duration: 0.2)) {
                isExpanded.toggle()
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("AI summary: \(text)")
        .accessibilityHint(isExpanded ? "Tap to collapse" : "Tap to expand")
        .accessibilityActions {
            if showsRegenerate, !isRegenerating {
                Button("Regenerate", action: onRegenerate)
            }
        }
    }

    private var header: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "sparkles")
                .font(.system(size: 11, weight: .semibold))
            Text("AI SUMMARY")
                .font(.captionText.weight(.semibold))
                .kerning(0.8)

            Spacer()

            Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .rotationEffect(.degrees(isExpanded ? 180 : 0))
        }
        .foregroundStyle(Color.accentWarm)
    }

    private var regenerateRow: some View {
        Button(action: onRegenerate) {
            HStack(spacing: Spacing.xs) {
                if isRegenerating {
                    ProgressView()
                        .controlSize(.small)
                        .tint(Color.accentWarm)
                    Text("Regenerating…")
                } else {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Regenerate")
                }
            }
            .font(.captionText.weight(.semibold))
            .foregroundStyle(Color.accentWarm)
            .frame(minHeight: 32, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isRegenerating)
        .accessibilityLabel(isRegenerating ? "Regenerating summary" : "Regenerate summary")
    }
}

/// Subtle loading card shown while the lazily-triggered first summary is in
/// flight (spec §5.1). Never blocks the content beneath it.
struct SummaryPendingCard: View {
    var body: some View {
        HStack(spacing: Spacing.s) {
            ProgressView()
                .controlSize(.small)
                .tint(Color.accentWarm)
            Text("Summarizing this entry…")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.secondaryBackground)
        )
        .accessibilityLabel("Summarizing this entry")
    }
}

/// Small retry affordance when the lazy summary failed — content below
/// stays fully readable.
struct SummaryRetryRow: View {

    let onRetry: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s) {
            Text("Couldn't summarize this entry.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)

            Button(action: onRetry) {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Try again")
                }
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Retry summary")

            Spacer()
        }
        .padding(.horizontal, Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.secondaryBackground)
        )
    }
}

// MARK: - Previews

#Preview("Light") {
    SummaryCardPreview()
}

#Preview("Dark") {
    SummaryCardPreview()
        .preferredColorScheme(.dark)
}

private struct SummaryCardPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ScrollView {
                VStack(spacing: Spacing.m) {
                    SummaryCard(
                        text: MockData.cannedSummary,
                        showsRegenerate: false,
                        isRegenerating: false,
                        onRegenerate: {}
                    )
                    SummaryCard(
                        text: MockData.cannedSummary,
                        showsRegenerate: true,
                        isRegenerating: false,
                        onRegenerate: {}
                    )
                    SummaryCard(
                        text: MockData.cannedSummary,
                        showsRegenerate: true,
                        isRegenerating: true,
                        onRegenerate: {}
                    )
                    SummaryPendingCard()
                    SummaryRetryRow(onRetry: {})
                }
                .padding()
            }
        }
    }
}
