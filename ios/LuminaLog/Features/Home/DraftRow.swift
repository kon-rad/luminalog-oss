import SwiftUI

/// A Home-list row for a local, unsaved draft. Mirrors `EntryRow`'s metrics with
/// a "Draft" badge and a text/media preview.
struct DraftRow: View {
    let draft: DraftEntry

    private var preview: String {
        let trimmed = draft.text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        if draft.attachments.contains(where: { $0.kind == .video }) { return "Video draft" }
        if draft.attachments.contains(where: { $0.kind == .audio }) { return "Voice draft" }
        if draft.attachments.contains(where: { $0.kind == .photo }) { return "Photo draft" }
        return "Empty draft"
    }

    var body: some View {
        HStack(spacing: Spacing.m) {
            Image(systemName: "pencil.and.outline")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.accentWarm)
                .frame(width: 40, height: 40)
                .background(Circle().fill(Color.accentWarm.opacity(0.12)))

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Draft")
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
                    .textCase(.uppercase)
                    .kerning(0.8)
                Text(preview)
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.textSecondary)
        }
        .padding(.vertical, Spacing.s)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Draft. \(preview). Tap to resume.")
    }
}
