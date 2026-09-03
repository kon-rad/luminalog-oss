import SwiftUI

/// Alternative to `RecoveryCodeEntryView` on `KeyGate`, shown when the account
/// has an `eoa` wrap on file (spec section 6.2 step 7). The two are
/// complementary, not exclusive: `KeyGate` offers both options so a locked-out
/// user can pick whichever key material they still have.
struct WalletUnlockView: View {
    let failedAttempt: Bool
    let isSubmitting: Bool
    var onUnlock: () -> Void
    var onUseRecoveryCodeInstead: () -> Void
    var onSignOut: () -> Void

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(spacing: Spacing.l) {
                VStack(spacing: Spacing.s) {
                    Image(systemName: "wallet.pass")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.accentWarm)
                    Text("Unlock with your wallet")
                        .font(.sectionHeader)
                        .foregroundStyle(Color.textPrimary)
                    Text("Connect the wallet you used to set this up and sign a message to unlock your journal.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }

                if failedAttempt {
                    Text("That wallet didn't unlock your journal. Make sure it's the same wallet you connected before.")
                        .font(.captionText)
                        .foregroundStyle(Color.danger)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                KeyGatePrimaryButton(
                    title: isSubmitting ? "Unlocking…" : "Connect Wallet and Unlock",
                    disabled: isSubmitting,
                    action: onUnlock
                )

                Button("Use my recovery code instead", action: onUseRecoveryCodeInstead)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)

                Button("Sign in with a different account", action: onSignOut)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
            .padding(Spacing.l)
        }
        .interactiveDismissDisabled(true)
    }
}

#Preview {
    WalletUnlockView(failedAttempt: false, isSubmitting: false, onUnlock: {}, onUseRecoveryCodeInstead: {}, onSignOut: {})
}
