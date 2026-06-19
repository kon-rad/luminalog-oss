import SwiftUI

/// Credit store sheet. Shows RevenueCat's hosted credits paywall; after a
/// purchase it flips to "Updating your balance…" while the server webhook
/// credits Firestore, then shows the new balance.
struct CreditsView: View {

    @Environment(\.dismiss) private var dismiss

    @StateObject private var viewModel: CreditsViewModel

    init(credits: CreditService) {
        _viewModel = StateObject(wrappedValue: CreditsViewModel(credits: credits))
    }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            if viewModel.isUpdatingBalance {
                updating
            } else if viewModel.didCompletePurchase {
                updated
            } else {
                HostedPaywall(
                    offeringIdentifier: "credits",
                    displayCloseButton: true,
                    onPurchaseCompleted: { _ in viewModel.beginBalanceRefresh() }
                )
            }
        }
        .overlay(alignment: .topTrailing) {
            if !viewModel.isUpdatingBalance { closeButton }
        }
        .task { viewModel.start() }
    }

    // MARK: - Updating

    private var updating: some View {
        VStack(spacing: Spacing.m) {
            ProgressView().tint(Color.accentWarm)
            Text("Updating your balance…")
                .font(.uiBody.weight(.medium))
                .foregroundStyle(Color.textPrimary)
            Text("Your credits are being added.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(Spacing.xl)
    }

    // MARK: - Updated

    private var updated: some View {
        VStack(spacing: Spacing.l) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.accentWarm)
            Text("\(viewModel.balance) credits")
                .font(.statValue)
                .foregroundStyle(Color.textPrimary)
            Text(viewModel.balanceWasSlow
                 ? "This can take a moment after purchase — it'll update shortly."
                 : "Your balance is updated.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
            Button { dismiss() } label: {
                Text("Done")
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Capsule().fill(Color.accentWarm))
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s)
        }
        .padding(Spacing.xl)
    }

    // MARK: - Close

    private var closeButton: some View {
        Button { dismiss() } label: {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.textSecondary)
                .frame(width: 32, height: 32)
                .background(Circle().fill(Color.secondaryBackground))
        }
        .buttonStyle(.plain)
        .padding(Spacing.m)
        .accessibilityLabel("Close credit store")
    }
}

#Preview("Store") {
    Color.appBackground.sheet(isPresented: .constant(true)) {
        CreditsView(credits: MockCreditService(balance: 12))
    }
}
