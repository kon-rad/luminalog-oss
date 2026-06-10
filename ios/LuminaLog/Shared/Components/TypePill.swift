import SwiftUI
import UIKit

// MARK: - JournalType presentation

extension JournalType {

    /// Display label for the type pill.
    var displayName: String {
        switch self {
        case .text: return "Text"
        case .voice: return "Voice"
        case .video: return "Video"
        case .image: return "Image"
        }
    }

    /// SF Symbol used for the type pill.
    var systemImage: String {
        switch self {
        case .text: return "text.alignleft"
        case .voice: return "waveform"
        case .video: return "video"
        case .image: return "photo"
        }
    }

    /// Per-type tint — warm hues in the accent family that read in both modes.
    var tint: Color {
        switch self {
        case .text:
            return .accentWarm
        case .voice:
            return Color(uiColor: UIColor { traits in
                traits.userInterfaceStyle == .dark
                    ? UIColor(red: 0.88, green: 0.50, blue: 0.50, alpha: 1.0)
                    : UIColor(red: 0.76, green: 0.34, blue: 0.36, alpha: 1.0) // warm rose
            })
        case .video:
            return Color(uiColor: UIColor { traits in
                traits.userInterfaceStyle == .dark
                    ? UIColor(red: 0.74, green: 0.56, blue: 0.82, alpha: 1.0)
                    : UIColor(red: 0.52, green: 0.36, blue: 0.60, alpha: 1.0) // warm plum
            })
        case .image:
            return Color(uiColor: UIColor { traits in
                traits.userInterfaceStyle == .dark
                    ? UIColor(red: 0.66, green: 0.72, blue: 0.42, alpha: 1.0)
                    : UIColor(red: 0.42, green: 0.50, blue: 0.26, alpha: 1.0) // warm olive
            })
        }
    }
}

// MARK: - TypePill

/// Small capsule indicating a journal entry's type (design §4 type tags).
struct TypePill: View {

    let type: JournalType

    var body: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: type.systemImage)
                .font(.system(size: 10, weight: .semibold))
            Text(type.displayName)
                .font(.captionText.weight(.semibold))
        }
        .foregroundStyle(type.tint)
        .padding(.horizontal, Spacing.s)
        .padding(.vertical, Spacing.xs)
        .background(
            Capsule().fill(type.tint.opacity(0.15))
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(type.displayName) entry")
    }
}

// MARK: - Previews

#Preview("Light") {
    TypePillPreviewGrid()
}

#Preview("Dark") {
    TypePillPreviewGrid()
        .preferredColorScheme(.dark)
}

private struct TypePillPreviewGrid: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            HStack(spacing: Spacing.s) {
                ForEach(JournalType.allCases, id: \.self) { type in
                    TypePill(type: type)
                }
            }
            .padding()
        }
    }
}
