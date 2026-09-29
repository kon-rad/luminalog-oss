import SwiftUI

/// One outline row: a period (tap to open its summary and children) or an entry
/// (tap to read it). Spec: docs/superpowers/specs/2026-09-28-story-accordion-design.md.
struct StoryRowView: View {

    let row: StoryRow
    let isExpanded: Bool
    let onToggle: () -> Void

    private static let indentPerLevel: CGFloat = 12
    private static let maxIndentLevels = 4

    var body: some View {
        Group {
            if row.node.kind == .entry {
                entryRow(row.node)
            } else {
                periodRow(row.node)
            }
        }
        .padding(.leading, CGFloat(min(row.depth, Self.maxIndentLevels)) * Self.indentPerLevel)
    }

    // MARK: - Period

    private func periodRow(_ node: StoryNode) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Button(action: onToggle) {
                HStack(alignment: .top, spacing: Spacing.s) {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text(StoryOutline.labelLine(node))
                            .font(.captionText.weight(.semibold))
                            .foregroundStyle(Color.textSecondary)
                            .textCase(.uppercase)
                        HStack(alignment: .firstTextBaseline, spacing: Spacing.xs) {
                            if node.isStandout {
                                Circle()
                                    .fill(Color.accentWarm)
                                    .frame(width: 7, height: 7)
                                    .accessibilityHidden(true)
                            }
                            Text(node.title ?? "Not summarized yet")
                                .font(node.key?.type == .all ? .journalDetailTitle : .entryTitle)
                                .foregroundStyle(node.title == nil ? Color.textSecondary : Color.textPrimary)
                                .multilineTextAlignment(.leading)
                        }
                        if let sentence = node.sentence {
                            Text(sentence)
                                .font(.journalBody)
                                .foregroundStyle(Color.textSecondary)
                                .lineLimit(isExpanded ? nil : 2)
                                .multilineTextAlignment(.leading)
                        }
                        if let note = continuationNote(node.continuation) {
                            Text(note)
                                .font(.captionText)
                                .foregroundStyle(Color.textSecondary)
                        }
                    }
                    Spacer(minLength: 0)
                    if node.hasChildren {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.textSecondary.opacity(0.6))
                            .rotationEffect(.degrees(isExpanded ? 90 : 0))
                            .padding(.top, Spacing.xs)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(periodAccessibilityLabel(node))
            .accessibilityValue(node.hasChildren ? (isExpanded ? "expanded" : "collapsed") : "")
            .accessibilityHint(node.hasChildren ? "Shows the summary and what's inside" : "")

            if isExpanded, let summary = node.summary {
                Text(summary)
                    .font(.journalBody)
                    .foregroundStyle(Color.textPrimary)
                if let asOf = node.openAsOfDay {
                    Text(node.isCurrent
                         ? "Written \(PeriodSummaryIndex.dayLabel(asOf)); this period is still going."
                         : "Written \(PeriodSummaryIndex.dayLabel(asOf)).")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                grounding(node)
            }
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }

    /// Quotes, key moments and threads under an open period's paragraph. Each quote
    /// and moment links to its entry.
    @ViewBuilder
    private func grounding(_ node: StoryNode) -> some View {
        if !node.quotes.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s) {
                Text("In your words")
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.textSecondary)
                    .textCase(.uppercase)
                ForEach(Array(node.quotes.enumerated()), id: \.offset) { _, quote in
                    NavigationLink(value: StoryEntryRoute(entryId: quote.entryId)) {
                        VStack(alignment: .leading, spacing: Spacing.xs) {
                            Text("\u{201C}\(quote.quote)\u{201D}")
                                .font(.journalBody.italic())
                                .foregroundStyle(Color.textPrimary)
                                .multilineTextAlignment(.leading)
                            Text(quote.attribution)
                                .font(.captionText)
                                .foregroundStyle(Color.textSecondary)
                        }
                        .padding(.leading, Spacing.s)
                        .overlay(alignment: .leading) {
                            Rectangle().fill(Color.accentWarm.opacity(0.5)).frame(width: 2)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Opens the entry")
                }
            }
            .padding(.top, Spacing.xs)
        }
        if !node.keyMoments.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                ForEach(node.keyMoments, id: \.kind) { moment in
                    NavigationLink(value: StoryEntryRoute(entryId: moment.entryId)) {
                        HStack(spacing: Spacing.s) {
                            Text(moment.kind.heading)
                                .font(.captionText.weight(.semibold))
                                .foregroundStyle(Color.textSecondary)
                                .textCase(.uppercase)
                            Text(moment.title)
                                .font(.uiBody)
                                .foregroundStyle(Color.textPrimary)
                                .lineLimit(1)
                            Spacer(minLength: Spacing.s)
                            Text(moment.attribution)
                                .font(.captionText)
                                .foregroundStyle(Color.textSecondary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(moment.kind.heading): \(moment.title), \(moment.attribution)")
                    .accessibilityHint("Opens the entry")
                }
            }
            .padding(.top, Spacing.xs)
        }
        if !node.threads.isEmpty {
            Text("Threads: \(node.threads.joined(separator: " · "))")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
    }

    private func periodAccessibilityLabel(_ node: StoryNode) -> String {
        var label = "\(StoryOutline.labelLine(node)), \(node.title ?? "Not summarized yet")"
        if node.isStandout { label += ", a standout period" }
        if let sentence = node.sentence { label += ". \(sentence)" }
        return label
    }

    private func continuationNote(_ continuation: StoryContinuation) -> String? {
        switch continuation {
        case .none: return nil
        case .continuesInto(let month): return "Continues into \(month)"
        case .continuedFrom(let month): return "Continued from \(month)"
        }
    }

    // MARK: - Entry

    private func entryRow(_ node: StoryNode) -> some View {
        NavigationLink(value: StoryEntryRoute(entryId: node.entryId ?? "")) {
            HStack(spacing: Spacing.s) {
                if let type = node.entryType {
                    Image(systemName: type.systemImage)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(type.tint)
                        .frame(width: 20)
                }
                Text(node.title ?? "Untitled")
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s)
                Text(node.label)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(.vertical, Spacing.s)
            .padding(.horizontal, Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(node.title ?? "Untitled"), \(node.label)")
        .accessibilityHint("Opens the entry")
    }
}
