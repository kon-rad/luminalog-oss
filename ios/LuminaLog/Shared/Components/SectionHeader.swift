import SwiftUI

/// Simple section title with an optional trailing action (e.g. "Show more").
struct SectionHeader: View {

    let title: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Previews

#Preview("Light") {
    SectionHeaderPreview()
}

#Preview("Dark") {
    SectionHeaderPreview()
        .preferredColorScheme(.dark)
}

private struct SectionHeaderPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: Spacing.m) {
                SectionHeader(title: "Recent entries", actionTitle: "Show more", action: {})
                SectionHeader(title: "Insights")
            }
            .padding()
        }
    }
}
