import SwiftUI

/// Journal list row (design §2/§3): date (and optional time), title,
/// first 100 characters of content, with a trailing type pill.
struct EntryRow: View {

    let entry: JournalEntry
    var showsTime: Bool = false

    private var dateText: String {
        if showsTime {
            return entry.createdAt.formatted(date: .abbreviated, time: .shortened)
        }
        return entry.createdAt.formatted(date: .abbreviated, time: .omitted)
    }

    private var contentPreview: String {
        let trimmed = entry.content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > 100 else { return trimmed }
        return String(trimmed.prefix(100)) + "…"
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.m) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(dateText)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)

                Text(entry.title)
                    .font(.entryTitle)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)

                if !contentPreview.isEmpty {
                    Text(contentPreview)
                        .font(.subheadline)
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 0)

            TypePill(type: entry.type)
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Previews

#Preview("Light") {
    EntryRowPreviewList()
}

#Preview("Dark") {
    EntryRowPreviewList()
        .preferredColorScheme(.dark)
}

private struct EntryRowPreviewList: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ScrollView {
                VStack(spacing: Spacing.s) {
                    ForEach(MockData.journalEntries.prefix(4)) { entry in
                        EntryRow(entry: entry, showsTime: true)
                    }
                    ForEach(MockData.journalEntries.prefix(2)) { entry in
                        EntryRow(entry: entry)
                    }
                }
                .padding()
            }
        }
    }
}
