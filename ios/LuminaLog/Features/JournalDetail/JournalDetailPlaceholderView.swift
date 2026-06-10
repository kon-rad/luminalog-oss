import SwiftUI

/// Navigation route to a journal entry's detail screen.
/// Home and the Journal list push this value; Task 6 replaces the
/// placeholder destination with the real detail view.
struct JournalDetailRoute: Hashable {
    let entryId: String
}

/// Simple titled placeholder for the Journal Detail screen (built in Task 6).
struct JournalDetailPlaceholderView: View {

    let entryId: String

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: Spacing.m) {
                Image(systemName: "doc.text")
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(Color.accentWarm.opacity(0.8))
                Text("Journal Detail — coming in Task 6")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)
                Text(entryId)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .navigationTitle("Entry")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Previews

#Preview {
    NavigationStack {
        JournalDetailPlaceholderView(entryId: "demo-entry-01")
    }
}
