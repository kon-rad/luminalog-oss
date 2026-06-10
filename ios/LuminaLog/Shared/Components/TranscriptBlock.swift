import SwiftUI

/// Labeled transcript/OCR section with serif body text.
/// Long texts collapse to ~8 lines with a Show more/less toggle (design §4).
struct TranscriptBlock: View {

    /// Section label, e.g. "Transcribed text" or "Transcript".
    let label: String
    let text: String

    @State private var isExpanded = false

    private static let collapsedLineLimit = 8

    /// Heuristic for "longer than ~8 lines".
    private var isLong: Bool {
        text.count > 500 || text.filter(\.isNewline).count >= Self.collapsedLineLimit
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text(label.uppercased())
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.textSecondary)
                .kerning(0.8)

            Text(text)
                .font(.journalBody)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(isExpanded || !isLong ? nil : Self.collapsedLineLimit)
                .fixedSize(horizontal: false, vertical: true)

            if isLong {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack(spacing: Spacing.xs) {
                        Text(isExpanded ? "Show less" : "Show more")
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
                    .frame(minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.secondaryBackground)
        )
    }
}

// MARK: - Previews

#Preview("Light") {
    TranscriptBlockPreview()
}

#Preview("Dark") {
    TranscriptBlockPreview()
        .preferredColorScheme(.dark)
}

private struct TranscriptBlockPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ScrollView {
                VStack(spacing: Spacing.m) {
                    TranscriptBlock(
                        label: "Transcript",
                        text: MockData.journalEntries.first(where: { $0.type == .voice })?.content
                            ?? MockData.journalEntries[0].content
                    )
                    TranscriptBlock(
                        label: "Transcribed text",
                        text: "A short note that fits well within eight lines."
                    )
                }
                .padding()
            }
        }
    }
}
