import SwiftUI
import UIKit

/// Bottom-panel voice recorder. Occupies the lower portion of the screen so the
/// prompt banner (if any) and the journal editor remain visible above it.
/// Both the X (top-right of the panel) and the Stop button finalize the recording
/// via `onStop`. There is no discard path.
struct RecordingOverlayView: View {

    @ObservedObject var recorder: AudioRecorderController
    /// If non-nil, the answered prompt is shown at the top of the panel so the
    /// user can read it while speaking.
    let promptText: String?
    let onStop: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Drag handle
            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                .fill(Color.textSecondary.opacity(0.3))
                .frame(width: 36, height: 5)
                .padding(.top, Spacing.s)
                .padding(.bottom, Spacing.xs)

            // Prompt reminder (only when answering a prompt)
            if let promptText {
                HStack(alignment: .top, spacing: Spacing.s) {
                    Rectangle()
                        .fill(Color.accentWarm)
                        .frame(width: 3)
                    Text(promptText)
                        .font(.promptQuoteCompact)
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, Spacing.m)
                .padding(.bottom, Spacing.s)
            }

            // Waveform + timer row
            HStack(spacing: Spacing.m) {
                WaveformView(levels: recorder.levels)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)

                Text(recorder.elapsedLabel)
                    .font(.system(.body, design: .default).weight(.semibold).monospacedDigit())
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize()
                    .accessibilityLabel("Recording, \(recorder.elapsedLabel)")
            }
            .padding(.horizontal, Spacing.m)

            // Controls row: stop button (centered) + X dismiss
            HStack {
                Spacer()

                Button(action: onStop) {
                    ZStack {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 64, height: 64)
                        Image(systemName: "stop.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Stop recording")

                Spacer()
            }
            .overlay(alignment: .trailing) {
                Button(action: onStop) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.textSecondary)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.secondaryBackground))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Stop recording")
                .padding(.trailing, Spacing.m)
            }
            .padding(.vertical, Spacing.m)
        }
        .background(
            Color.appBackground
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
                .shadow(color: .black.opacity(0.12), radius: 16, x: 0, y: -4)
                .ignoresSafeArea(edges: .bottom)
        )
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    }
}
