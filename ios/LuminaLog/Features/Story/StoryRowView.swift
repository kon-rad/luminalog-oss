import SwiftUI

/// One outline row, set like a 19th-century paper: collapsed, a period is one line
/// of a table of contents (small-caps name, italic title, entry count); open, its
/// summary runs the full width of the page as a justified paragraph, whatever its
/// depth, with quotes set as indented extracts and a footnote for open periods.
/// Only the heading lines indent, so the nesting reads as an outline while the text
/// keeps the width. Spec: docs/superpowers/specs/2026-09-28-story-accordion-design.md.
struct StoryRowView: View {

    let row: StoryRow
    let isExpanded: Bool
    let onToggle: () -> Void

    private static let indentPerLevel: CGFloat = 10
    private static let maxIndentLevels = 5
    private static let extractInset: CGFloat = 14

    private var indent: CGFloat { CGFloat(min(row.depth, Self.maxIndentLevels)) * Self.indentPerLevel }

    var body: some View {
        if row.node.kind == .entry {
            entryRow(row.node)
        } else if row.node.key?.type == .all {
            titleBlock(row.node)
        } else {
            periodRow(row.node)
        }
    }

    // MARK: - Period

    private func periodRow(_ node: StoryNode) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if Self.hasRuleAbove(node) {
                Rectangle().fill(Color.textSecondary.opacity(0.35)).frame(height: 0.5)
                    .padding(.bottom, 2)
            }
            Button(action: onToggle) { heading(node) }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(periodAccessibilityLabel(node))
                .accessibilityValue(node.hasChildren ? (isExpanded ? "expanded" : "collapsed") : "")
                .accessibilityHint(node.hasChildren ? "Shows the summary and what's inside" : "")
            if isExpanded { section(of: node).padding(.bottom, 4) }
        }
        .padding(.top, isExpanded ? 8 : 2)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The contents line: marker, small-caps name, italic title, count. One line
    /// collapsed; the full title when open.
    private func heading(_ node: StoryNode) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(isExpanded ? "\u{25BE}" : "\u{25B8}")
                .font(.system(size: 11))
                .foregroundStyle(node.hasChildren ? (isExpanded ? Color.accentWarm : Color.textSecondary.opacity(0.7)) : .clear)
                .frame(width: 10)
                .accessibilityHidden(true)
            headingText(node)
                .lineLimit(isExpanded ? nil : 1)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 4)
            Text("\(node.entryCount)")
                .font(.system(.caption, design: .serif).monospacedDigit())
                .foregroundStyle(Color.textSecondary)
                .accessibilityHidden(true)
        }
        .padding(.leading, indent)
        .padding(.vertical, 3)
        .contentShape(Rectangle())
    }

    private func headingText(_ node: StoryNode) -> Text {
        let name = Text(StoryOutline.shortLabel(node) + (node.isCurrent ? " (so far)" : ""))
            .font(Self.nameFont(node).smallCaps())
            .foregroundColor(isExpanded ? .accentWarm : .textSecondary)
        // A manicule marks a standout period, as a printer would mark a passage.
        let mark = node.isStandout ? Text("  \u{261E}\u{FE0E}").foregroundColor(.accentWarm) : Text("")
        let title = node.title.map {
            Text("  \($0)").font(Self.titleFont(node)).foregroundColor(.textPrimary)
        } ?? Text("  not yet written").font(Self.titleFont(node)).foregroundColor(.textSecondary)
        return name + mark + title
    }

    /// The open section: the gist run into the summary, then extracts, key moments,
    /// threads, and the "written while open" footnote.
    @ViewBuilder
    private func section(of node: StoryNode) -> some View {
        if let summary = node.summary {
            PaperText(lead: node.sentence, text: summary)
            grounding(node)
            if let asOf = node.openAsOfDay {
                Text("\u{2020} Written \(PeriodSummaryIndex.dayLabel(asOf))\(node.isCurrent ? "; the period is still going." : ".")")
                    .font(.system(.caption, design: .serif).italic())
                    .foregroundStyle(Color.textSecondary)
            }
        } else if let sentence = node.sentence {
            PaperText(text: sentence)
        }
    }

    /// Quotes as indented extracts with a right-set attribution, then key moments and
    /// threads as run-in lines. Each quote and moment links to its entry.
    @ViewBuilder
    private func grounding(_ node: StoryNode) -> some View {
        ForEach(Array(node.quotes.enumerated()), id: \.offset) { _, quote in
            NavigationLink(value: StoryEntryRoute(entryId: quote.entryId)) {
                VStack(alignment: .trailing, spacing: 2) {
                    PaperText(text: "\u{201C}\(quote.quote)\u{201D}", style: .callout)
                    Text(quote.attribution)
                        .font(.system(.caption, design: .serif).smallCaps())
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(1)
                }
                .padding(.horizontal, Self.extractInset)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the entry")
        }
        if !node.keyMoments.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(node.keyMoments, id: \.kind) { moment in
                    NavigationLink(value: StoryEntryRoute(entryId: moment.entryId)) {
                        (Text("\(moment.kind.heading). ").font(.system(.footnote, design: .serif).smallCaps())
                            .foregroundColor(.textSecondary)
                         + Text(moment.title).font(.system(.footnote, design: .serif).italic())
                            .foregroundColor(.textPrimary)
                         + Text(", \(moment.attribution)").font(.system(.footnote, design: .serif))
                            .foregroundColor(.textSecondary))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(moment.kind.heading): \(moment.title), \(moment.attribution)")
                    .accessibilityHint("Opens the entry")
                }
            }
        }
        if !node.threads.isEmpty {
            (Text("Threads: ").font(.system(.footnote, design: .serif).smallCaps())
             + Text(node.threads.joined(separator: "; ") + ".").font(.system(.footnote, design: .serif).italic()))
                .foregroundStyle(Color.textSecondary)
        }
    }

    // MARK: - All time

    /// The root reads as the paper's title: name and title centered over a double
    /// rule, then the abstract.
    private func titleBlock(_ node: StoryNode) -> some View {
        VStack(spacing: 6) {
            Button(action: onToggle) {
                VStack(spacing: 2) {
                    Text("\(StoryOutline.shortLabel(node)) \u{00B7} \(node.entryCount == 1 ? "1 entry" : "\(node.entryCount) entries")")
                        .font(.system(.footnote, design: .serif).smallCaps())
                        .foregroundStyle(Color.textSecondary)
                    Text(node.title ?? "Your story")
                        .font(.system(.title2, design: .serif).weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(periodAccessibilityLabel(node))
            .accessibilityValue(isExpanded ? "expanded" : "collapsed")
            VStack(spacing: 2) {
                Rectangle().frame(height: 1.2)
                Rectangle().frame(height: 0.5)
            }
            .foregroundStyle(Color.textPrimary.opacity(0.7))
            if isExpanded {
                VStack(alignment: .leading, spacing: 6) { section(of: node) }
            }
        }
        .padding(.top, 4)
        .padding(.bottom, 6)
    }

    // MARK: - Entry

    private func entryRow(_ node: StoryNode) -> some View {
        NavigationLink(value: StoryEntryRoute(entryId: node.entryId ?? "")) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(node.label)
                    .font(.system(.caption, design: .serif).monospacedDigit())
                    .foregroundStyle(Color.textSecondary)
                if let type = node.entryType {
                    Image(systemName: type.systemImage)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(type.tint)
                }
                Text(node.title ?? "Untitled")
                    .font(.system(.subheadline, design: .serif))
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text("\u{203A}")
                    .font(.system(.subheadline, design: .serif))
                    .foregroundStyle(Color.textSecondary.opacity(0.7))
            }
            .padding(.leading, indent + 15)
            .padding(.vertical, 3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(node.title ?? "Untitled"), \(node.label)")
        .accessibilityHint("Opens the entry")
    }

    // MARK: - Type

    /// Years, quarters and months open a new section, so a hairline sets them off.
    private static func hasRuleAbove(_ node: StoryNode) -> Bool {
        guard let type = node.key?.type else { return false }
        return type == .year || type == .quarter || type == .month
    }

    private static func nameFont(_ node: StoryNode) -> Font {
        switch node.key?.type {
        case .year: return .system(.headline, design: .serif).weight(.semibold)
        case .quarter, .month: return .system(.subheadline, design: .serif).weight(.semibold)
        default: return .system(.subheadline, design: .serif)
        }
    }

    private static func titleFont(_ node: StoryNode) -> Font {
        switch node.key?.type {
        case .year: return .system(.headline, design: .serif).italic()
        default: return .system(.subheadline, design: .serif).italic()
        }
    }

    private func periodAccessibilityLabel(_ node: StoryNode) -> String {
        var label = "\(StoryOutline.labelLine(node)), \(node.title ?? "Not summarized yet")"
        if node.isStandout { label += ", a standout period" }
        if let sentence = node.sentence { label += ". \(sentence)" }
        return label
    }
}
