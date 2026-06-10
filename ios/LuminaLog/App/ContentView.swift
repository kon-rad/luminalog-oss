import SwiftUI

/// Placeholder root view for the scaffold. Replaced by the real
/// navigation shell in a later task.
struct ContentView: View {
    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: Spacing.l) {
                Spacer()

                Text("LuminaLog")
                    .font(.journalTitle)
                    .foregroundStyle(Color.textPrimary)

                Text("A quiet place for your thoughts.")
                    .font(.promptQuote)
                    .foregroundStyle(Color.textSecondary)

                if !AppConfig.isFirebaseConfigured {
                    Text("Demo Mode")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                        .padding(.horizontal, Spacing.m)
                        .padding(.vertical, Spacing.xs)
                        .background(
                            Capsule()
                                .fill(Color.accentWarm.opacity(0.15))
                        )
                }

                Spacer()
            }
            .padding(Spacing.l)
        }
    }
}

#Preview {
    ContentView()
}
