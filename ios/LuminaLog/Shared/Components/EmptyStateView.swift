import SwiftUI

/// Reusable empty state — icon, title, message, optional action button.
/// Used by Home, Journal list, Chats and Insights empty states.
struct EmptyStateView: View {

    let systemImage: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Spacing.m) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.accentWarm.opacity(0.8))

            Text(title)
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            Text(message)
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, Spacing.l)
                        .frame(minHeight: 44)
                        .background(
                            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                                .fill(Color.accentWarm)
                        )
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.s)
            }
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Previews

#Preview("Light") {
    EmptyStateViewPreview()
}

#Preview("Dark") {
    EmptyStateViewPreview()
        .preferredColorScheme(.dark)
}

private struct EmptyStateViewPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: Spacing.l) {
                EmptyStateView(
                    systemImage: "book.closed",
                    title: "No entries yet",
                    message: "Your journal is waiting for its first page. Capture a thought, a moment, or a voice note.",
                    actionTitle: "Write your first entry",
                    action: {}
                )
                EmptyStateView(
                    systemImage: "sparkles",
                    title: "No insights yet",
                    message: "Generate insights to see themes and patterns in this entry."
                )
            }
        }
    }
}
