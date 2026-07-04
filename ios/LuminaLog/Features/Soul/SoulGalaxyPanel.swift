import SwiftUI

/// Home hero: the dark galaxy panel. Renders the loaded galaxy (tappable to
/// expand), a shimmer while loading, a quiet error, and a nascent-soul empty
/// state. Fails soft — never blocks Home.
struct SoulGalaxyPanel: View {
    @ObservedObject var viewModel: SoulViewModel

    private let panelBackground = LinearGradient(
        colors: [Color(red: 0.18, green: 0.16, blue: 0.37), Color(red: 0.02, green: 0.02, blue: 0.03)],
        startPoint: .topLeading, endPoint: .bottomTrailing)

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28, style: .continuous).fill(panelBackground)
            content
        }
        .frame(height: 340)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(.white.opacity(0.06)))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Soul constellation")
    }

    private var hasStars: Bool { (viewModel.payload?.constellation.points.count ?? 0) > 0 }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            ProgressView().tint(Color.accentWarm)
        case .failed:
            Text("Couldn't load your soul right now.")
                .font(.captionText).italic()
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center).padding(.horizontal, Spacing.l)
        case .loaded:
            if hasStars {
                SoulGalaxyWebView(points: viewModel.payload?.constellation.points ?? [])
            } else {
                VStack(spacing: Spacing.s) {
                    Circle().fill(Color.accentWarm.opacity(0.85)).frame(width: 12, height: 12)
                        .shadow(color: Color.accentWarm.opacity(0.7), radius: 12)
                    Text("Your constellation begins with your first 750-word day.")
                        .font(.captionText).italic()
                        .foregroundStyle(.white.opacity(0.85))
                        .multilineTextAlignment(.center).padding(.horizontal, Spacing.l)
                }
            }
        }
    }
}
