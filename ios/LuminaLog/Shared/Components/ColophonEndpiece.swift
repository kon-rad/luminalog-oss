import SwiftUI

/// Decorative "end of page" colophon mark shown at the very bottom of scrolling
/// content (e.g. the Journal Detail tabs). The source asset is dark line-art on
/// a transparent background; it's rendered as a template so it tints to a quiet,
/// theme-aware ink in both light and dark mode. Purely ornamental.
struct ColophonEndpiece: View {

    /// Longest edge of the mark. The asset is a 5:1 divider, so height follows.
    var width: CGFloat = 240

    var body: some View {
        Image("ColophonEndpiece")
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .frame(maxWidth: width)
            .foregroundStyle(Color.textSecondary.opacity(0.55))
            .frame(maxWidth: .infinity, alignment: .center)
            .accessibilityHidden(true)
    }
}

// MARK: - Previews

#Preview("Light") {
    ColophonEndpiecePreview()
}

#Preview("Dark") {
    ColophonEndpiecePreview()
        .preferredColorScheme(.dark)
}

private struct ColophonEndpiecePreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ColophonEndpiece()
                .padding()
        }
    }
}
