import SwiftUI

/// Credit store sheet — shows current balance, available packs, and purchase CTA.
/// Presented when the user tries to start a voice call without credits, or from
/// the profile screen to top up at any time.
struct CreditsView: View {

    @Environment(\.dismiss) private var dismiss

    @StateObject private var viewModel: CreditsViewModel

    init(credits: CreditService) {
        _viewModel = StateObject(wrappedValue: CreditsViewModel(credits: credits))
    }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.l) {
                    header
                    balanceCard
                    howItWorks
                    packSection
                    if let message = viewModel.errorMessage {
                        errorText(message)
                    }
                }
                .padding(.horizontal, Spacing.m)
                .padding(.top, Spacing.xl + Spacing.m)
                .padding(.bottom, Spacing.xl)
            }
        }
        .overlay(alignment: .topTrailing) { closeButton }
        .task { viewModel.start() }
        .onChange(of: viewModel.didPurchase) { _, bought in
            if bought { dismiss() }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: Spacing.s) {
            Image(systemName: "phone.and.waveform.fill")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Color.accentWarm)

            Text("Voice Credits")
                .font(.journalTitle)
                .foregroundStyle(Color.textPrimary)

            Text("1 credit = 1 minute of AI voice conversation")
                .font(.promptQuoteCompact)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Balance card

    private var balanceCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Your Balance")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                Text("\(viewModel.balance) min")
                    .font(.statValue)
                    .foregroundStyle(viewModel.balance == 0 ? Color.danger : Color.textPrimary)
            }
            Spacer()
            Image(systemName: viewModel.balance == 0 ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                .font(.system(size: 24))
                .foregroundStyle(viewModel.balance == 0 ? Color.danger : Color.accentWarm)
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }

    // MARK: - How it works

    private var howItWorks: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            Text("How credits work")
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.textPrimary)

            rowItem("clock.fill", "Charged per minute", "Each minute of voice call uses 1 credit. Partial minutes round up.")
            rowItem("cart.fill", "One-time purchase", "Credits never expire and are not part of your subscription.")
            rowItem("arrow.triangle.2.circlepath", "Restore anytime", "Credits are linked to your account — reinstall and restore anytime.")
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }

    private func rowItem(_ icon: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.m) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Color.accentWarm)
                .frame(width: 28, height: 28)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous)
                        .fill(Color.accentWarm.opacity(0.12))
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.uiBody.weight(.medium))
                    .foregroundStyle(Color.textPrimary)
                Text(detail)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }

    // MARK: - Packs

    @ViewBuilder
    private var packSection: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            Text("Top up credits")
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.textPrimary)

            if let packs = viewModel.packs {
                if packs.isEmpty {
                    Text("Credit packs aren't available right now.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                } else {
                    ForEach(packs) { pack in
                        packRow(pack)
                    }
                }
            } else {
                ProgressView("Loading packs…")
                    .font(.captionText)
                    .tint(Color.accentWarm)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.m)
            }
        }
    }

    private func packRow(_ pack: CreditPack) -> some View {
        Button {
            Task { await viewModel.purchase(pack) }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Spacing.xs) {
                        Text("\(pack.credits) minutes")
                            .font(.uiBody.weight(.semibold))
                            .foregroundStyle(Color.textPrimary)
                        if pack.popular {
                            Text("Most popular")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, Spacing.s)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(Color.accentWarm))
                        }
                    }
                    Text("\(pack.price) one-time")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                if viewModel.isPurchasing {
                    ProgressView()
                        .tint(Color.accentWarm)
                } else {
                    Text(pack.price)
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                }
            }
            .padding(Spacing.m)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .strokeBorder(
                        pack.popular ? Color.accentWarm.opacity(0.5) : Color.textSecondary.opacity(0.15),
                        lineWidth: pack.popular ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isPurchasing)
        .accessibilityLabel("\(pack.credits) minute credit pack, \(pack.price)")
    }

    // MARK: - Error

    private func errorText(_ message: String) -> some View {
        HStack(spacing: Spacing.s) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.danger)
            Text(message)
                .font(.captionText)
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                .fill(Color.danger.opacity(0.1))
        )
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

// MARK: - Previews

#Preview("Has credits") {
    Color.appBackground
        .sheet(isPresented: .constant(true)) {
            CreditsView(credits: MockCreditService(balance: 45))
        }
}

#Preview("No credits") {
    Color.appBackground
        .sheet(isPresented: .constant(true)) {
            CreditsView(credits: MockCreditService(balance: 0))
        }
}

#Preview("Dark") {
    Color.appBackground
        .sheet(isPresented: .constant(true)) {
            CreditsView(credits: MockCreditService(balance: 12))
                .preferredColorScheme(.dark)
        }
}
