import SwiftUI

/// State of an AI generate/regenerate action (design §4).
enum AIActionState: Equatable {
    case idle
    case loading
    case failed
}

/// The generate/regenerate button used by Insights, Prompts and the
/// summary card — idle, loading (disabled) and failed (retry) states.
struct AIActionButton: View {

    let title: String
    let loadingTitle: String
    let state: AIActionState
    let action: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s) {
            if state == .failed {
                Text("Something went wrong.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }

            Button(action: action) {
                HStack(spacing: Spacing.s) {
                    switch state {
                    case .idle:
                        Image(systemName: "sparkles")
                        Text(title)
                    case .loading:
                        ProgressView()
                            .tint(.white)
                        Text(loadingTitle)
                    case .failed:
                        Image(systemName: "arrow.clockwise")
                        Text("Try Again")
                    }
                }
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                        .fill(Color.accentWarm.opacity(state == .loading ? 0.6 : 1.0))
                )
            }
            .buttonStyle(.plain)
            .disabled(state == .loading)
            .accessibilityLabel(state == .loading ? loadingTitle : (state == .failed ? "Try again" : title))
        }
    }
}

// MARK: - Previews

#Preview("Light") {
    AIActionButtonPreview()
}

#Preview("Dark") {
    AIActionButtonPreview()
        .preferredColorScheme(.dark)
}

private struct AIActionButtonPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: Spacing.l) {
                AIActionButton(
                    title: "Generate Insights",
                    loadingTitle: "Analyzing your entry…",
                    state: .idle,
                    action: {}
                )
                AIActionButton(
                    title: "Generate Insights",
                    loadingTitle: "Analyzing your entry…",
                    state: .loading,
                    action: {}
                )
                AIActionButton(
                    title: "Generate Insights",
                    loadingTitle: "Analyzing your entry…",
                    state: .failed,
                    action: {}
                )
            }
            .padding()
        }
    }
}
