import SwiftUI

/// Settings entry to enroll the eoa key-wrap slot (spec §6.3): it
/// explicitly states that iCloud and the recovery code keep working regardless,
/// so a user never assumes connecting a wallet REPLACES their existing
/// backstops.
struct EOAKeyWrapCard: View {
    let isEnrolled: Bool
    let isWorking: Bool
    let errorMessage: String?
    var onEnroll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("Unlock with Wallet")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            Text("iCloud and your recovery code remain fully valid whether or not you set this up. Losing wallet access never affects access to your journal through those other methods.")
                .font(.footnote)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if isEnrolled {
                Label("Your wallet can unlock your journal", systemImage: "checkmark.circle.fill")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
            } else {
                if let errorMessage {
                    Text(errorMessage)
                        .font(.captionText)
                        .foregroundStyle(Color.danger)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button(action: onEnroll) {
                    Text(isWorking ? "Setting up…" : "Use this wallet to unlock my journal")
                        .font(.uiBody.weight(.medium))
                        .foregroundStyle(Color.accentWarm)
                        .multilineTextAlignment(.leading)
                }
                .buttonStyle(.plain)
                .disabled(isWorking)
            }
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                .fill(Color.cardBackground)
        )
    }
}

#Preview("Not enrolled") {
    EOAKeyWrapCard(isEnrolled: false, isWorking: false, errorMessage: nil, onEnroll: {})
        .padding()
}

#Preview("Enrolled") {
    EOAKeyWrapCard(isEnrolled: true, isWorking: false, errorMessage: nil, onEnroll: {})
        .padding()
}
