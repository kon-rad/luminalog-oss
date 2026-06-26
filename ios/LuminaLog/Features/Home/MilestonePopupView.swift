import SwiftUI

/// Full-height sheet shown once/day when the 750-word goal is crossed.
struct MilestonePopupView: View {
    let target: Int
    let onGenerate: () -> Void
    let onDismiss: () -> Void

    @State private var appeared = false

    var body: some View {
        VStack(spacing: Spacing.m) {
            Spacer()

            Text("🎉")
                .font(.system(size: 72))
                .scaleEffect(appeared ? 1 : 0.4)
                .animation(.spring(response: 0.5, dampingFraction: 0.6), value: appeared)

            Text("\(target) words today!")
                .font(.journalTitle).foregroundStyle(Color.textPrimary)

            Text("Congratulations — you completed your daily writing challenge.")
                .font(.uiBody).foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)

            Spacer()

            Button(action: onGenerate) {
                Text("Generate your daily insights report")
                    .font(.uiBody.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.accentWarm)

            Button("Maybe later", action: onDismiss)
                .font(.captionText).foregroundStyle(Color.textSecondary)
                .padding(.top, Spacing.xs)
        }
        .padding(Spacing.l)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground.ignoresSafeArea())
        .onAppear { appeared = true }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Congratulations, you reached \(target) words today.")
    }
}

#Preview {
    MilestonePopupView(target: 750, onGenerate: {}, onDismiss: {})
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
}
