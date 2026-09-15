import SwiftUI

/// A small auto-dismissing confirmation pill anchored to the bottom of the view.
private struct ToastModifier: ViewModifier {
    @Binding var message: String?
    let duration: Duration

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let message {
                Text(message)
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.m)
                    .padding(.vertical, Spacing.s)
                    .background(Capsule().fill(.black.opacity(0.8)))
                    .padding(.bottom, Spacing.xl)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: message) {
                        try? await Task.sleep(for: duration)
                        withAnimation { self.message = nil }
                    }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: message)
    }
}

extension View {
    /// Shows a transient toast whenever `message` becomes non-nil, then clears it.
    /// `duration` defaults to a short confirmation-length pill (e.g. "Copied!");
    /// pass a longer value for a toast carrying a full sentence, like an error.
    func toast(message: Binding<String?>, duration: Duration = .seconds(1.8)) -> some View {
        modifier(ToastModifier(message: message, duration: duration))
    }
}
