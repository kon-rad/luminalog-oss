import SwiftUI

/// Full-screen photo viewer for journal images (design §4: tap image to
/// zoom): black background, pinch-to-zoom (1×–4×), drag down or the X
/// button to dismiss.
struct ImageZoomViewer: View {

    let url: URL

    @Environment(\.dismiss) private var dismiss

    /// Committed zoom scale (clamped 1–4 on gesture end).
    @State private var scale: CGFloat = 1
    /// In-flight pinch factor, composed onto `scale` while the gesture runs.
    @GestureState private var pinch: CGFloat = 1
    /// Vertical drag-to-dismiss offset (only active when not zoomed in).
    @State private var dragOffset: CGFloat = 0

    private static let minScale: CGFloat = 1
    private static let maxScale: CGFloat = 4
    private static let dismissThreshold: CGFloat = 120

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black
                .ignoresSafeArea()

            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .scaleEffect(displayScale)
                        .offset(y: dragOffset)
                        .gesture(magnification)
                        .simultaneousGesture(dragToDismiss)
                        .accessibilityLabel("Journal photo, full screen")
                case .failure:
                    unavailable
                case .empty:
                    ProgressView()
                        .tint(.white)
                @unknown default:
                    unavailable
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            closeButton
        }
        .preferredColorScheme(.dark)
    }

    private var displayScale: CGFloat {
        min(max(scale * pinch, Self.minScale), Self.maxScale)
    }

    // MARK: - Gestures

    private var magnification: some Gesture {
        MagnificationGesture()
            .updating($pinch) { value, state, _ in
                state = value
            }
            .onEnded { value in
                scale = min(max(scale * value, Self.minScale), Self.maxScale)
            }
    }

    /// Drag down to dismiss — only when the image isn't zoomed in, so
    /// panning intent while zoomed doesn't accidentally close the viewer.
    private var dragToDismiss: some Gesture {
        DragGesture()
            .onChanged { value in
                guard scale <= 1.01 else { return }
                dragOffset = max(0, value.translation.height)
            }
            .onEnded { value in
                if scale <= 1.01, value.translation.height > Self.dismissThreshold {
                    dismiss()
                } else {
                    withAnimation(.spring(duration: 0.25)) {
                        dragOffset = 0
                    }
                }
            }
    }

    // MARK: - Chrome

    private var closeButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(.white.opacity(0.15)))
        }
        .buttonStyle(.plain)
        .padding(Spacing.m)
        .accessibilityLabel("Close photo viewer")
    }

    private var unavailable: some View {
        VStack(spacing: Spacing.s) {
            Image(systemName: "photo")
                .font(.system(size: 36, weight: .light))
            Text("Photo unavailable")
                .font(.captionText)
        }
        .foregroundStyle(.white.opacity(0.7))
        .accessibilityLabel("Photo unavailable")
    }
}

// MARK: - Previews

#Preview {
    ImageZoomViewer(url: URL(fileURLWithPath: "/tmp/missing.jpg"))
}
