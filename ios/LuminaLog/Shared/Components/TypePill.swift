import SwiftUI

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

    /// Per-type tint — theme tokens (see Theme.swift).
    var tint: Color {
        switch self {
        case .text: return .tintText
        case .voice: return .tintVoice
        case .video: return .tintVideo
        case .image: return .tintImage
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
        .foregroundStyle(.white)
        .padding(.horizontal, Spacing.s)
        .padding(.vertical, Spacing.xs)
        .background(
            Capsule().fill(type.tint)
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
