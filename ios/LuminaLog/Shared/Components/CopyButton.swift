import SwiftUI
import UIKit

/// Small inline "Copy" affordance that writes `text` to the system clipboard and
/// briefly flips to a "Copied" checkmark for confirmation. Matches the caption /
/// accent-warm styling used by the other in-card header buttons (e.g. Edit).
struct CopyButton: View {

    /// The text placed on the clipboard when tapped.
    let text: String
    /// Trailing word shown next to the icon. Defaults to "Copy".
    var label: String = "Copy"
    /// VoiceOver label describing what gets copied, e.g. "Copy entry".
    var accessibilityText: String = "Copy"

    @State private var didCopy = false

    var body: some View {
        Button {
            UIPasteboard.general.string = text
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
            withAnimation(.easeInOut(duration: 0.15)) {
                didCopy = true
            }
            Task {
                try? await Task.sleep(nanoseconds: 1_800_000_000)
                withAnimation(.easeInOut(duration: 0.15)) {
                    didCopy = false
                }
            }
        } label: {
            HStack(spacing: Spacing.xs) {
                Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                Text(didCopy ? "Copied" : label)
            }
            .font(.captionText.weight(.semibold))
            .foregroundStyle(Color.accentWarm)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(text.isEmpty)
        .accessibilityLabel(didCopy ? "Copied" : accessibilityText)
    }
}

// MARK: - Previews

#Preview("Light") {
    CopyButtonPreview()
}

#Preview("Dark") {
    CopyButtonPreview()
        .preferredColorScheme(.dark)
}

private struct CopyButtonPreview: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: Spacing.l) {
                CopyButton(text: "Some copied text", accessibilityText: "Copy entry")
                CopyButton(text: "", accessibilityText: "Copy entry")
            }
            .padding()
        }
    }
}
