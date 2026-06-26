import SwiftUI
import UIKit

/// Full-screen, interaction-blocking voice recorder. The waveform reacts to live
/// mic input; both the X (top-right) and the Stop button (bottom-center) finalize
/// the recording via `onStop`. There is no discard path.
struct RecordingOverlayView: View {

    @ObservedObject var recorder: AudioRecorderController
    let onStop: () -> Void

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    Button(action: onStop) {
                        Image(systemName: "xmark")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Color.textSecondary)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Stop recording")
                }
                .padding(.horizontal, Spacing.m)
                .padding(.top, Spacing.s)

                Spacer()

                WaveformView(levels: recorder.levels)
                    .frame(height: 160)
                    .padding(.horizontal, Spacing.l)

                Text(recorder.elapsedLabel)
                    .font(.system(.largeTitle, design: .default).weight(.semibold).monospacedDigit())
                    .foregroundStyle(Color.textPrimary)
                    .padding(.top, Spacing.l)
                    .accessibilityLabel("Recording, \(recorder.elapsedLabel)")

                Spacer()

                Button(action: onStop) {
                    ZStack {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 80, height: 80)
                        Image(systemName: "stop.fill")
                            .font(.system(size: 30))
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Stop recording")
                .padding(.bottom, Spacing.xl)
            }
        }
        .interactiveDismissDisabled(true)
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    }
}
