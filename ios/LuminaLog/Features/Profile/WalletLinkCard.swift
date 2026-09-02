import SwiftUI

/// Settings entry to link/view a connected wallet for sign-in (spec §5).
/// Deliberately distinct from `SettingsView.walletCard`, which shows the
/// server-minted LuminaSoul NFT address, an unrelated custodial concept.
struct WalletLinkCard: View {
    let linkedAddress: String?
    let isWorking: Bool
    var onConnect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("Sign-In Wallet")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            if let linkedAddress {
                Text("Linked: \(linkedAddress.prefix(6))…\(linkedAddress.suffix(4))")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                Text("iCloud and your recovery code still work, whether or not a wallet is connected.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            } else {
                Text("Link a wallet as an additional way to sign in to this account.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                Button(action: onConnect) {
                    Text(isWorking ? "Connecting…" : "Connect Wallet")
                        .font(.uiBody.weight(.medium))
                        .foregroundStyle(Color.accentWarm)
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

#Preview("Not linked") {
    WalletLinkCard(linkedAddress: nil, isWorking: false, onConnect: {})
        .padding()
}

#Preview("Linked") {
    WalletLinkCard(linkedAddress: "0x1234567890123456789012345678901234567890", isWorking: false, onConnect: {})
        .padding()
}
