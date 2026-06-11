import SwiftUI

/// The LuminaLog Pro paywall sheet (design §9 subscription entry point):
/// wordmark, benefit list, selectable offer cards, purchase CTA, restore,
/// and auto-renew fine print — calm and warm, no urgency tricks.
struct PaywallView: View {

    @Environment(\.dismiss) private var dismiss

    @StateObject private var viewModel: PaywallViewModel

    init(subscriptions: SubscriptionService) {
        self.init(viewModel: PaywallViewModel(subscriptions: subscriptions))
    }

    /// Internal init for previews/tests that pre-seed the view model.
    init(viewModel: PaywallViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.l) {
                    header
                    benefits
                    if viewModel.isAlreadyPro {
                        proBadge
                    }
                    offerSection
                    if let message = viewModel.errorMessage {
                        errorText(message)
                    }
                }
                .padding(.horizontal, Spacing.m)
                .padding(.top, Spacing.xl + Spacing.m)
                .padding(.bottom, Spacing.m)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ctaBar
        }
        .overlay(alignment: .topTrailing) {
            closeButton
        }
        .task { viewModel.start() }
        .onChange(of: viewModel.didUnlockPro) { _, unlocked in
            if unlocked { dismiss() }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: Spacing.s) {
            Image(systemName: "sun.horizon.fill")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Color.accentWarm)

            Text("LuminaLog")
                .font(.journalTitle)
                .foregroundStyle(Color.textPrimary)

            Text("Pro")
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
                .padding(.horizontal, Spacing.m)
                .padding(.vertical, Spacing.xs)
                .background(Capsule().fill(Color.accentWarm.opacity(0.15)))

            Text("Give your journal a deeper memory.")
                .font(.promptQuoteCompact)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Benefits

    private var benefits: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            benefitRow("sparkles", "Unlimited AI insights & prompts",
                       "Fresh reflections and questions for every entry.")
            benefitRow("waveform", "Voice, video & photo entries",
                       "Capture moments however they arrive.")
            benefitRow("bubble.left.and.bubble.right.fill", "Chat with your journal",
                       "Ask anything — it remembers what you've written.")
            benefitRow("phone.and.waveform.fill", "Voice conversations",
                       "Talk things through with your AI companion.")
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }

    private func benefitRow(_ systemName: String, _ title: String, _ subtitle: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.m) {
            Image(systemName: systemName)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Color.accentWarm)
                .frame(width: 30, height: 30)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous)
                        .fill(Color.accentWarm.opacity(0.12))
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.uiBody.weight(.medium))
                    .foregroundStyle(Color.textPrimary)
                Text(subtitle)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }

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

    private var proBadge: some View {
        Label("You're already a Pro member — thank you.", systemImage: "checkmark.seal.fill")
            .font(.captionText.weight(.medium))
            .foregroundStyle(Color.accentWarm)
    }

    // MARK: - Offers

    @ViewBuilder
    private var offerSection: some View {
        if let offers = viewModel.offers {
            if offers.isEmpty {
                Text("Subscriptions aren't available right now.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            } else {
                HStack(spacing: Spacing.m) {
                    ForEach(offers) { offer in
                        offerCard(offer)
                    }
                }
            }
        } else {
            ProgressView("Loading plans…")
                .font(.captionText)
                .tint(Color.accentWarm)
                .padding(.vertical, Spacing.l)
        }
    }

    private func offerCard(_ offer: SubscriptionOffer) -> some View {
        let isSelected = viewModel.selectedOfferId == offer.id
        let isAnnual = offer.period == "year"

        return Button {
            viewModel.select(offer)
        } label: {
            VStack(spacing: Spacing.xs) {
                if isAnnual {
                    Text("Best value")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, Spacing.s)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.accentWarm))
                } else {
                    // Keep both cards the same height.
                    Text(" ")
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.vertical, 3)
                }

                Text(periodName(offer.period))
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(Color.textPrimary)

                Text(offer.price)
                    .font(.statValue)
                    .foregroundStyle(Color.textPrimary)

                Text("per \(offer.period)")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.m)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(isSelected ? Color.accentWarm.opacity(0.1) : Color.cardBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .strokeBorder(
                        isSelected ? Color.accentWarm : Color.textSecondary.opacity(0.2),
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(periodName(offer.period)) plan, \(offer.price) per \(offer.period)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func periodName(_ period: String) -> String {
        switch period {
        case "month": return "Monthly"
        case "year": return "Annual"
        case "week": return "Weekly"
        default: return period.capitalized
        }
    }

    // MARK: - CTA bar

    private var ctaBar: some View {
        VStack(spacing: Spacing.s) {
            Button {
                Task { await viewModel.purchase() }
            } label: {
                Group {
                    if viewModel.isPurchasing {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text(ctaTitle)
                            .font(.uiBody.weight(.semibold))
                    }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(
                    Capsule().fill(Color.accentWarm.opacity(ctaDisabled ? 0.4 : 1))
                )
            }
            .buttonStyle(.plain)
            .disabled(ctaDisabled)
            .accessibilityLabel(viewModel.isPurchasing ? "Purchasing" : ctaTitle)

            Button {
                Task { await viewModel.restore() }
            } label: {
                if viewModel.isRestoring {
                    ProgressView()
                        .tint(Color.accentWarm)
                } else {
                    Text("Restore Purchases")
                        .font(.captionText.weight(.medium))
                        .foregroundStyle(Color.accentWarm)
                }
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isRestoring || viewModel.isPurchasing)
            .frame(minHeight: 28)

            Text("Subscriptions renew automatically until cancelled. Manage or cancel anytime in your App Store account settings.")
                .font(.system(size: 11))
                .foregroundStyle(Color.textSecondary.opacity(0.8))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, Spacing.m)
        .padding(.top, Spacing.s)
        .padding(.bottom, Spacing.m)
        .background(Color.appBackground)
    }

    private var ctaTitle: String {
        if let offer = viewModel.selectedOffer {
            return "Continue — \(offer.price)/\(offer.period)"
        }
        return "Continue"
    }

    private var ctaDisabled: Bool {
        viewModel.selectedOffer == nil || viewModel.isPurchasing || viewModel.isRestoring
    }

    // MARK: - Close

    private var closeButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.textSecondary)
                .frame(width: 32, height: 32)
                .background(Circle().fill(Color.secondaryBackground))
        }
        .buttonStyle(.plain)
        .padding(Spacing.m)
        .accessibilityLabel("Close paywall")
    }
}

// MARK: - Previews

#Preview("Offers") {
    Color.appBackground
        .sheet(isPresented: .constant(true)) {
            PaywallView(subscriptions: MockSubscriptionService())
        }
}

#Preview("Loading") {
    Color.appBackground
        .sheet(isPresented: .constant(true)) {
            PaywallView(subscriptions: StallingSubscriptionService())
        }
}

#Preview("Dark") {
    Color.appBackground
        .sheet(isPresented: .constant(true)) {
            PaywallView(subscriptions: MockSubscriptionService())
                .preferredColorScheme(.dark)
        }
}

/// Preview-only service whose offerings never resolve — pins the loading state.
@MainActor
private final class StallingSubscriptionService: SubscriptionService {
    func entitlementStream() -> AsyncStream<Entitlement> {
        AsyncStream { $0.yield(Entitlement()) }
    }
    func setUser(_ uid: String?) async {}
    func purchase(productId: String) async throws {}
    func restore() async throws {}
    func offerings() async throws -> [SubscriptionOffer] {
        try? await Task.sleep(nanoseconds: 3_600_000_000_000)
        return []
    }
}
