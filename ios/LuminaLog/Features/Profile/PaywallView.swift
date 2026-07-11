import SwiftUI
import RevenueCat
import RevenueCatUI

/// Thin wrapper around RevenueCat's hosted `PaywallView`. Loads an offering by
/// identifier (nil = the current offering) and renders its dashboard-designed
/// paywall. When RevenueCat isn't configured (demo/preview builds) it shows a
/// graceful unavailable state instead of crashing on `Purchases.shared`.
struct HostedPaywall: View {

    /// Offering identifier to load, or nil for the current offering.
    let offeringIdentifier: String?
    let displayCloseButton: Bool
    var onPurchaseCompleted: ((CustomerInfo) -> Void)? = nil
    var onRestoreCompleted: ((CustomerInfo) -> Void)? = nil

    @State private var offering: Offering?
    @State private var loadFailed = false
    @State private var debugMessage: String = ""

    var body: some View {
        Group {
            if !Purchases.isConfigured || loadFailed {
                unavailable
            } else if let offering {
                RevenueCatUI.PaywallView(offering: offering, displayCloseButton: displayCloseButton)
                    .onPurchaseCompleted { info in onPurchaseCompleted?(info) }
                    .onRestoreCompleted { info in onRestoreCompleted?(info) }
            } else {
                ZStack {
                    Color.appBackground.ignoresSafeArea()
                    ProgressView().tint(Color.accentWarm)
                }
            }
        }
        .task { await load() }
    }

    private var unavailable: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: 8) {
                Text("Plans aren't available right now.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                #if DEBUG
                Text(debugMessage)
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                #endif
            }
        }
    }

    private func load() async {
        guard Purchases.isConfigured, offering == nil else {
            debugMessage = "Purchases.isConfigured=\(Purchases.isConfigured)"
            return
        }
        do {
            let offerings = try await Purchases.shared.offerings()
            let allKeys = offerings.all.keys.joined(separator: ", ")
            if let id = offeringIdentifier {
                offering = offerings.offering(identifier: id) ?? offerings.all[id]
                if offering == nil {
                    debugMessage = "offering '\(id)' not found. Available: [\(allKeys)]"
                    loadFailed = true
                }
            } else {
                offering = offerings.current
                if offering == nil {
                    debugMessage = "current offering is nil. Available: [\(allKeys)]"
                    loadFailed = true
                }
            }
        } catch {
            debugMessage = "offerings() threw: \(error)"
            loadFailed = true
        }
    }
}

/// LuminaLog Pro paywall — RevenueCat's hosted (dashboard-designed) paywall for
/// the current offering. Used as the dismissible Profile sheet and as the hard
/// app-entry gate (non-dismissible, with a Sign out escape the hosted paywall
/// doesn't provide). Unlock is observed via the entitlement stream upstream
/// (PaywallGate) and via dismiss here.
struct SubscriptionPaywall: View {

    @Environment(\.dismiss) private var dismiss

    private let isDismissible: Bool
    private let onSignOut: (() -> Void)?

    init(isDismissible: Bool = true, onSignOut: (() -> Void)? = nil) {
        self.isDismissible = isDismissible
        self.onSignOut = onSignOut
    }

    var body: some View {
        HostedPaywall(
            offeringIdentifier: nil, // current offering
            displayCloseButton: isDismissible,
            onPurchaseCompleted: { _ in if isDismissible { dismiss() } },
            onRestoreCompleted: { info in
                if isDismissible, info.entitlements[SubscriptionGate.proEntitlementId]?.isActive == true {
                    dismiss()
                }
            }
        )
        .overlay(alignment: .bottom) {
            VStack(spacing: Spacing.s) {
                if !isDismissible, let onSignOut {
                    Button { onSignOut() } label: {
                        Text("Sign out")
                            .font(.captionText)
                            .foregroundStyle(Color.textSecondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Sign out")
                }
                PaywallLegalFooter()
            }
            .padding(.bottom, Spacing.m)
        }
    }
}

/// Terms of Use + Privacy Policy links, rendered natively at the bottom of every
/// subscription paywall (App Store Guideline 3.1.2(c)). Kept in-app — rather than
/// relying solely on the RevenueCat hosted-paywall template's footer config — so
/// the required legal links are always present and verifiable in the binary.
struct PaywallLegalFooter: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        HStack(spacing: Spacing.s) {
            link("Terms of Use", "https://luminalog.com/terms")
            Text("·").foregroundStyle(Color.textSecondary.opacity(0.5))
            link("Privacy Policy", "https://luminalog.com/privacy")
        }
        .font(.caption2)
        .padding(.vertical, 6)
        .padding(.horizontal, Spacing.m)
        .background(Capsule().fill(.ultraThinMaterial))
    }

    private func link(_ title: String, _ urlString: String) -> some View {
        Button {
            if let url = URL(string: urlString) { openURL(url) }
        } label: {
            Text(title)
                .underline()
                .foregroundStyle(Color.textSecondary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityHint("Opens in Safari")
    }
}

/// Namespacing for the single Pro entitlement id, kept identical to
/// `RevenueCatSubscriptionService.proEntitlementId`.
enum SubscriptionGate {
    static let proEntitlementId = "pro"
}

#Preview("Gate (sign-out)") {
    SubscriptionPaywall(isDismissible: false, onSignOut: {})
}

#Preview("Dismissible") {
    Color.appBackground.sheet(isPresented: .constant(true)) {
        SubscriptionPaywall()
    }
}
