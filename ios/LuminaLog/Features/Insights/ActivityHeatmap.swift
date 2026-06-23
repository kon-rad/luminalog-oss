import SwiftUI

/// GitHub-style calendar heatmap. Columns are weeks; rows are weekdays
/// (Sun…Sat). Cell intensity scales with entries written that day.
struct ActivityHeatmap: View {
    let days: [ActivityDay]
    var calendar: Calendar = .current

    /// Group days into week columns keyed by weekday (1...7).
    private var weeks: [[ActivityDay?]] {
        guard let first = days.first else { return [] }
        var columns: [[ActivityDay?]] = []
        var current = [ActivityDay?](repeating: nil, count: 7)
        let firstWeekday = calendar.component(.weekday, from: first.date) // 1=Sun
        // Pad the leading offset so week one aligns to the weekday rows.
        var slot = firstWeekday - 1
        for day in days {
            if slot > 6 { columns.append(current); current = [ActivityDay?](repeating: nil, count: 7); slot = 0 }
            current[slot] = day
            slot += 1
        }
        columns.append(current)
        return columns
    }

    private var maxCount: Int { max(days.map(\.entryCount).max() ?? 0, 1) }

    private func color(_ day: ActivityDay?) -> Color {
        guard let day, day.entryCount > 0 else { return Color.secondary.opacity(0.12) }
        let t = Double(day.entryCount) / Double(maxCount)
        return Color.accentWarm.opacity(0.25 + 0.75 * t)
    }

    private var totalEntries: Int { days.reduce(0) { $0 + $1.entryCount } }
    private var activeDays: Int { days.filter { $0.entryCount > 0 }.count }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 3) {
                ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                    VStack(spacing: 3) {
                        ForEach(0..<7, id: \.self) { row in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(color(week[row]))
                                .frame(width: 12, height: 12)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Journaling activity calendar")
        .accessibilityValue(Text("\(totalEntries) entries across \(activeDays) active days"))
    }
}

#Preview {
    let cal = Calendar.current
    let today = cal.startOfDay(for: Date())
    let days = (0..<70).reversed().map { offset -> ActivityDay in
        let d = cal.date(byAdding: .day, value: -offset, to: today)!
        return ActivityDay(date: d, entryCount: offset % 4, wordCount: offset * 10)
    }
    return ActivityHeatmap(days: days).padding()
}
