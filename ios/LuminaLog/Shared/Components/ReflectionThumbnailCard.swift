import SwiftUI

/// 120×150 pt thumbnail card shown in the Daily Reflections carousel.
struct ReflectionThumbnailCard: View {
    let report: DailyInsightsReport
    var badge: String? = nil

    private var displayDate: String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: report.date) else { return report.date }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(
                colors: [Color.accentWarm.opacity(0.35), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.xs) {
                    Text(displayDate)
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                    if let badge {
                        Text(badge)
                            .font(.system(size: 7, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Capsule().fill(Color.accentWarm))
                    }
                }

                Spacer(minLength: Spacing.s)

                if let top = report.emotions.first {
                    Text(top.name)
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    GeometryReader { geo in
                        Capsule()
                            .fill(.white.opacity(0.15))
                            .overlay(alignment: .leading) {
                                Capsule()
                                    .fill(Color.accentWarm)
                                    .frame(width: geo.size.width * min(1, max(0, CGFloat(top.score))))
                            }
                    }
                    .frame(height: 3)
                    .padding(.top, 3)
                }

                Spacer(minLength: Spacing.xs)

                Text("\(report.totalWords.formatted()) words  🔥\(report.streakCount)")
                    .font(.captionText)
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(1)
            }
            .padding(Spacing.s)
        }
        .frame(width: 120, height: 150)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
    }
}

#Preview {
    ReflectionThumbnailCard(report: .init(
        date: "2026-06-22",
        insights: "", findings: "", gem: "", emotionSummary: "",
        totalWords: 847, streakCount: 14,
        emotions: [.init(name: "Calm", score: 0.72)]
    ))
    .padding()
    .background(Color.appBackground)
}
