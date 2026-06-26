import SwiftUI

/// Mirrored, scrolling waveform driven by a buffer of normalized levels (0...1).
/// Newest sample renders on the right; older samples scroll left. Pure function
/// of `levels` — no internal animation timer.
struct WaveformView: View {

    let levels: [CGFloat]
    var color: Color = Color.tintVoice

    /// Number of bars drawn — matches `AudioRecorderController.maxLevelSamples`.
    static let barCount = 50

    var body: some View {
        Canvas { context, size in
            let count = Self.barCount
            let slot = size.width / CGFloat(count)
            let barWidth = slot * 0.5
            let midY = size.height / 2

            for index in 0..<count {
                let sampleIndex = levels.count - count + index
                let level = sampleIndex >= 0 ? levels[sampleIndex] : 0
                let barHeight = max(barWidth, level * size.height)
                let centerX = CGFloat(index) * slot + slot / 2
                let rect = CGRect(
                    x: centerX - barWidth / 2,
                    y: midY - barHeight / 2,
                    width: barWidth,
                    height: barHeight
                )
                context.fill(
                    Path(roundedRect: rect, cornerRadius: barWidth / 2),
                    with: .color(color)
                )
            }
        }
        .animation(.linear(duration: 0.05), value: levels)
        .accessibilityHidden(true)
    }
}
