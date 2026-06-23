import SwiftUI
import Charts

/// Daily count of entries by dominant emotion, one line per emotion.
struct EmotionTrendChart: View {
    let points: [EmotionTrendPoint]

    /// Distinct emotions in first-appearance order, for the a11y summary.
    private var emotions: [String] {
        var seen = Set<String>()
        return points.map(\.emotion).filter { seen.insert($0).inserted }
    }

    var body: some View {
        Chart(points) { point in
            LineMark(x: .value("Date", point.date),
                     y: .value("Entries", point.count))
                .foregroundStyle(by: .value("Emotion", point.emotion))
                .interpolationMethod(.catmullRom)
            PointMark(x: .value("Date", point.date),
                      y: .value("Entries", point.count))
                .foregroundStyle(by: .value("Emotion", point.emotion))
        }
        .chartLegend(position: .bottom)
        .frame(height: 220)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Emotional trends over time")
        .accessibilityValue(Text(emotions.isEmpty ? "No data"
            : "Emotions tracked: \(emotions.joined(separator: ", "))"))
    }
}

#Preview {
    let cal = Calendar.current
    let d0 = cal.startOfDay(for: Date())
    func day(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: d0)! }
    return EmotionTrendChart(points: [
        EmotionTrendPoint(date: day(3), emotion: "joy", count: 2),
        EmotionTrendPoint(date: day(2), emotion: "joy", count: 1),
        EmotionTrendPoint(date: day(2), emotion: "sadness", count: 1),
        EmotionTrendPoint(date: day(1), emotion: "joy", count: 3),
        EmotionTrendPoint(date: day(0), emotion: "anxiety", count: 1)
    ]).padding()
}
