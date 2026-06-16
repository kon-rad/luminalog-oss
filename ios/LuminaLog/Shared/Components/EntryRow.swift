import SwiftUI

/// Journal list row (design §2/§3): date (and optional time), title,
/// first 100 characters of content, with a trailing type pill.
struct EntryRow: View {

    let entry: JournalEntry
    var showsTime: Bool = false
    /// Required for thumbnail loading on image entries.
    var media: MediaUploader?

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

    private var thumbnailS3Key: String? {
        entry.media.first(where: { $0.kind == .image })?.thumbnailS3Key
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

            VStack(alignment: .trailing, spacing: Spacing.s) {
                if let key = thumbnailS3Key, let media {
                    EntryThumbnailView(s3Key: key, media: media)
                }
                TypePill(type: entry.type)
                EntryStatusBadge(entry: entry)
            }
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Status badge

/// Compact pill showing background-processing progress (Uploading…,
/// Transcribing…, Failed). Renders nothing once the entry has settled.
struct EntryStatusBadge: View {

    let entry: JournalEntry

    var body: some View {
        if let text = entry.statusBadgeText {
            let isFailed = entry.activityState == .failed
            let tint = isFailed ? Color.danger : Color.accentWarm
            HStack(spacing: Spacing.xs) {
                if isFailed {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 9, weight: .semibold))
                } else {
                    ProgressView()
                        .controlSize(.small)
                        .tint(tint)
                }
                Text(text)
                    .font(.captionText.weight(.medium))
            }
            .foregroundStyle(tint)
            .padding(.horizontal, Spacing.s)
            .padding(.vertical, 3)
            .background(Capsule().fill(tint.opacity(0.12)))
            .accessibilityLabel(text)
        }
    }
}

// MARK: - Thumbnail

/// Async thumbnail for image entries in the list.
private struct EntryThumbnailView: View {

    let s3Key: String
    let media: MediaUploader

    @State private var url: URL?

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        Color.secondaryBackground
                    }
                }
            } else {
                Color.secondaryBackground
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous))
        .task {
            url = try? await media.localFileURL(for: s3Key)
        }
    }
}

// MARK: - Skeleton placeholder entry

extension JournalEntry {
    /// Dummy entry used only for redacted skeleton rows.
    static var skeletonPlaceholder: JournalEntry {
        JournalEntry(
            id: UUID().uuidString,
            userId: "",
            type: .text,
            title: "A quiet moment to remember",
            content: "Placeholder content used for the redacted loading state of entry rows in lists."
        )
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
