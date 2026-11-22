import SwiftUI

/// A report that still needs generation. Opening it retries the stored date.
struct PendingReflectionCard: View {
    let date: String
    var badge: String? = nil

    private var displayDate: String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        guard let day = parser.date(from: date) else { return date }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: day)
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.goldSurface
            Image("CrosshatchInk")
                .resizable()
                .scaledToFit()
                .frame(width: 84, height: 84)
                .opacity(0.9)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

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
                            .background(Capsule().fill(Color.accentWarm))
                    }
                }
                Spacer(minLength: Spacing.s)
                Text("Daily Reflection")
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Spacer(minLength: Spacing.xs)
                Text("Tap to view")
                    .font(.captionText)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(Spacing.s)
        }
        .frame(width: 120, height: 150)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
    }
}
