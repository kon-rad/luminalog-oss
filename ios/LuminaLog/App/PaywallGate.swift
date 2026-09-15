import SwiftUI

/// Hard app-entry paywall. Renders `content` only when the Pro entitlement is
/// resolved-and-active; otherwise blocks the whole app with a non-dismissible
/// paywall. Pro = app access (see docs/PRICING.md); voice additionally meters
/// credits inside the app.
///
/// `content` (`RootView`) stays mounted at all times, with the paywall/spinner
/// overlaid on top while locked: the same "keep it mounted, toggle visibility"
/// technique `RootView.tabContent` uses for its own tabs. Previously this
/// `switch`ed between three structurally different view trees, which tore down
/// and remounted `RootView` the instant the entitlement resolved (see
/// ADR-0090). Remounting right after RevenueCat's UIKit-hosted paywall, whose
/// template plants a purchase panel across roughly the bottom half of the
/// screen, let that outgoing view's safe-area geometry bleed into
/// `AppTabBar`'s first layout pass, so on a brand-new subscriber's first
/// unlock the tab bar would render oversized for a frame before snapping to
/// its real height. Keeping `content()` permanently mounted means `AppTabBar`
/// never has an adjacent view's geometry to interpolate against.
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
        ZStack {
            content()
                .allowsHitTesting(viewModel.state == .unlocked)
                .accessibilityHidden(viewModel.state != .unlocked)

            switch viewModel.state {
            case .checking:
                ZStack {
                    Color.appBackground.ignoresSafeArea()
                    ProgressView().tint(Color.accentWarm)
                }
            case .locked:
                SubscriptionPaywall(isDismissible: false, onSignOut: onSignOut)
            case .unlocked:
                EmptyView()
            }
        }
        .task { viewModel.start() }
    }
}
