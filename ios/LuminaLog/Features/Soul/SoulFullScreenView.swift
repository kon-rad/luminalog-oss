import SwiftUI

/// Full-screen interactive galaxy, presented from the Home panel tap.
struct SoulFullScreenView: View {
    let points: [ConstellationPoint]
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            SoulGalaxyWebView(points: points)
                .ignoresSafeArea()
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white.opacity(0.9))
                    .padding(12)
                    .background(Circle().fill(.black.opacity(0.35)))
            }
            .padding(.top, Spacing.m)
            .padding(.trailing, Spacing.m)
        }
        .background(Color.black.ignoresSafeArea())
    }
}
