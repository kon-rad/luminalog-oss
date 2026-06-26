import SwiftUI

/// 120×150 pt error card shown in the carousel when a day's report failed to
/// generate. The whole card is a button that re-attempts generation.
struct ReflectionErrorCard: View {
    let date: String
    var badge: String? = nil

    private var displayDate: String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        guard let d = parser.date(from: date) else { return date }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: d)
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(
                colors: [Color.red.opacity(0.35), .black],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.xs) {
                    Text(displayDate)
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(.white)
                    if let badge {
                        Text(badge)
                            .font(.system(size: 7, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Capsule().fill(Color.red.opacity(0.8)))
                    }
                }

                Spacer(minLength: Spacing.s)

                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title3)
                    .foregroundStyle(.white.opacity(0.9))
                Text("Couldn't generate")
                    .font(.system(size: 10))
                    .foregroundStyle(.white.opacity(0.8))
                    .lineLimit(2)

                Spacer(minLength: Spacing.xs)

                Text("Try Again")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.s).padding(.vertical, 4)
                    .background(Capsule().fill(Color.red.opacity(0.85)))
            }
            .padding(Spacing.s)
        }
        .frame(width: 120, height: 150)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
    }
}

#Preview {
    ReflectionErrorCard(date: "2026-06-25", badge: "TODAY")
        .padding()
        .background(Color.appBackground)
}
