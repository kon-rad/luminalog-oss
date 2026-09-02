import SwiftUI

/// Third sign-in option on `SignInView`, styled to match `googleButton`
/// (outlined pill, not the HIG-mandated Apple style).
struct WalletConnectButton: View {
    var isWorking: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s) {
                Image(systemName: "wallet.pass")
                    .foregroundStyle(Color.accentWarm)
                Text("Connect a Wallet")
                    .font(.uiBody.weight(.medium))
                    .foregroundStyle(Color.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 50)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.medium)
                    .fill(Color.cardBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.medium)
                    .strokeBorder(Color.textSecondary.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isWorking)
        .opacity(isWorking ? 0.5 : 1)
    }
}

#Preview {
    WalletConnectButton(isWorking: false, action: {})
        .padding()
}
