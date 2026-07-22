import SwiftUI

// MARK: - Parsed block model

/// A single parsed block of Markdown-formatted text.
enum MarkdownBlock: Equatable {
    case heading(String, level: Int)
    case bullet(String)
    case ordered(String, number: Int)
    case paragraph(String)
}

/// Splits Markdown text into renderable blocks. Headings (`#…`), bullet lists
/// (`-`/`*`), and ordered lists (`1.`) are single lines; consecutive plain
/// lines are merged into a paragraph, and blank lines separate paragraphs.
///
/// Shared by the chat companion (`MessageBubble`) and AI insights
/// (`JournalDetailView`) so both format LLM Markdown identically.
func markdownBlocks(_ text: String) -> [MarkdownBlock] {
    var blocks: [MarkdownBlock] = []
    var paragraphLines: [String] = []

    func flushParagraph() {
        let joined = paragraphLines
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !joined.isEmpty { blocks.append(.paragraph(joined)) }
        paragraphLines.removeAll()
    }

    for rawLine in text.components(separatedBy: .newlines) {
        let line = rawLine.trimmingCharacters(in: .whitespaces)
        if line.isEmpty {
            flushParagraph()
        } else if line.hasPrefix("#") {
            flushParagraph()
            let hashes = line.prefix { $0 == "#" }
            let content = line.dropFirst(hashes.count).trimmingCharacters(in: .whitespaces)
            if !content.isEmpty { blocks.append(.heading(content, level: hashes.count)) }
        } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
            flushParagraph()
            blocks.append(.bullet(String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces)))
        } else if let ordered = orderedListItem(line) {
            flushParagraph()
            blocks.append(.ordered(ordered.content, number: ordered.number))
        } else {
            paragraphLines.append(line)
        }
    }
    flushParagraph()
    return blocks
}

/// Parses an ordered-list line like `1. Do the thing` into its number and
/// content. Returns nil when the line isn't a `<digits>.`/`<digits>)` item.
private func orderedListItem(_ line: String) -> (number: Int, content: String)? {
    let digits = line.prefix { $0.isNumber }
    guard !digits.isEmpty, let number = Int(digits) else { return nil }
    let afterDigits = line[digits.endIndex...]
    guard let marker = afterDigits.first, marker == "." || marker == ")" else { return nil }
    let content = afterDigits.dropFirst().trimmingCharacters(in: .whitespaces)
    guard !content.isEmpty else { return nil }
    return (number, content)
}

/// Parses inline Markdown (bold, italic, links, code) into an
/// `AttributedString`, falling back to plain text if parsing fails.
func inlineMarkdown(_ text: String) -> AttributedString {
    (try? AttributedString(
        markdown: text,
        options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
    )) ?? AttributedString(text)
}

// MARK: - Style

/// Typography and layout for a `MarkdownText`. Presets keep chat and insights
/// visually distinct while sharing one renderer.
struct MarkdownStyle {
    /// Font for a heading at the given Markdown level (1 = `#`, 2 = `##`, …).
    var headingFont: (Int) -> Font
    var bodyFont: Font
    var textColor: Color
    var bulletColor: Color
    var bulletGlyph: String
    var lineSpacing: CGFloat
    var blockSpacing: CGFloat
    var headingTopPadding: CGFloat

    /// AI insights on `JournalDetailView` — reproduces the original typography.
    static let insights = MarkdownStyle(
        headingFont: { $0 <= 2 ? .sectionHeader : .entryTitle },
        bodyFont: .journalBody,
        textColor: .textPrimary,
        bulletColor: .textSecondary,
        bulletGlyph: "•",
        lineSpacing: 6,
        blockSpacing: Spacing.m,
        headingTopPadding: Spacing.s
    )

    /// Assistant chat bubbles — restrained sizing for the narrow bubble width.
    static let chatBubble = MarkdownStyle(
        headingFont: { _ in .sectionHeader },
        bodyFont: .uiBody,
        textColor: .textPrimary,
        bulletColor: .textSecondary,
        bulletGlyph: "•",
        lineSpacing: 3,
        blockSpacing: Spacing.s,
        headingTopPadding: Spacing.xs
    )
}

// MARK: - Renderer

/// Renders Markdown text as a vertical stack of styled blocks (headings,
/// bullet/ordered lists, paragraphs) with inline emphasis. Empty input renders
/// nothing.
struct MarkdownText: View {

    let text: String
    let style: MarkdownStyle

    init(_ text: String, style: MarkdownStyle) {
        self.text = text
        self.style = style
    }

    var body: some View {
        VStack(alignment: .leading, spacing: style.blockSpacing) {
            ForEach(Array(markdownBlocks(text).enumerated()), id: \.offset) { _, block in
                blockView(block)
            }
        }
    }

    @ViewBuilder
    private func blockView(_ block: MarkdownBlock) -> some View {
        switch block {
        case let .heading(text, level):
            Text(inlineMarkdown(text))
                .font(style.headingFont(level))
                .foregroundStyle(style.textColor)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, style.headingTopPadding)
        case let .bullet(text):
            listRow(marker: style.bulletGlyph, text: text)
        case let .ordered(text, number):
            listRow(marker: "\(number).", text: text)
        case let .paragraph(text):
            Text(inlineMarkdown(text))
                .font(style.bodyFont)
                .foregroundStyle(style.textColor)
                .lineSpacing(style.lineSpacing)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func listRow(marker: String, text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
            Text(marker)
                .font(style.bodyFont)
                .foregroundStyle(style.bulletColor)
            Text(inlineMarkdown(text))
                .font(style.bodyFont)
                .foregroundStyle(style.textColor)
                .lineSpacing(style.lineSpacing)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Previews

#Preview("Chat bubble style") {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        MarkdownText(
            """
            **You did well this week.**

            A few things stood out:
            - Protected your mornings
            - Slept earlier

            1. Keep the morning ritual
            2. Note what helped

            You're building real *momentum*.
            """,
            style: .chatBubble
        )
        .padding()
    }
}
