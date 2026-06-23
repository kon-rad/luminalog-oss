import SwiftUI

/// Renders top words at sizes scaled by frequency, in a wrapping flow.
struct WordCloudView: View {
    let words: [WordFrequency]

    private var maxCount: Int { words.map(\.count).max() ?? 1 }
    private var minCount: Int { words.map(\.count).min() ?? 1 }

    var body: some View {
        WordCloudFlowLayout(spacing: 10) {
            ForEach(words) { item in
                Text(item.word)
                    .font(.system(size: wordCloudFontSize(count: item.count,
                                                           minCount: minCount,
                                                           maxCount: maxCount),
                                  weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.accentWarm.opacity(
                        0.55 + 0.45 * Double(item.count - minCount) /
                        Double(max(maxCount - minCount, 1))))
            }
        }
    }
}

#Preview {
    WordCloudView(words: [
        WordFrequency(word: "work", count: 42), WordFrequency(word: "family", count: 31),
        WordFrequency(word: "today", count: 28), WordFrequency(word: "grateful", count: 19),
        WordFrequency(word: "run", count: 14), WordFrequency(word: "coffee", count: 9),
        WordFrequency(word: "morning", count: 6), WordFrequency(word: "hope", count: 4)
    ])
    .padding()
}
