import SwiftUI

/// Hard app-entry paywall. Renders `content` only when the Pro entitlement is
/// resolved-and-active; otherwise blocks the whole app with a non-dismissible
/// paywall. Pro = app access (see docs/PRICING.md); voice additionally meters
/// credits inside the app.
struct PaywallGate<Content: View>: View {

    @StateObject private var viewModel: PaywallGateViewModel
    private let subscriptions: SubscriptionService
    private let onSignOut: (() -> Void)?
    private let content: () -> Content

    init(
        subscriptions: SubscriptionService,
        onSignOut: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.subscriptions = subscriptions
        self.onSignOut = onSignOut
        self.content = content
        _viewModel = StateObject(wrappedValue: PaywallGateViewModel(subscriptions: subscriptions))
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .checking:
                ZStack {
                    Color.appBackground.ignoresSafeArea()
                    ProgressView().tint(Color.accentWarm)
                }
            case .locked:
                PaywallView(subscriptions: subscriptions, isDismissible: false, onSignOut: onSignOut)
            case .unlocked:
                content()
            }
        }
        .task { viewModel.start() }
    }
}
