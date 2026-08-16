import SwiftUI

/// Locates a beat's quote inside the entry text.
///
/// "Always traceable" is the promise the map makes: every beat points back at the
/// exact words the writer wrote, checkable in one tap. The server verifies each quote
/// is a verbatim substring before the map is ever stored, so the offset is normally
/// exact. The search fallback covers the one case that survives that check, an entry
/// edited after mapping, where the offset has drifted but the sentence still exists.
/// If the sentence is gone entirely we highlight nothing rather than guess.
enum BeatQuoteHighlighter {

    static func range(in content: String, for beat: Beat) -> Range<String.Index>? {
        guard !beat.quote.isEmpty else { return nil }

        // Preferred path: the recorded UTF-16 offset, validated against the text.
        if beat.quoteStart >= 0,
           let start = String.Index(utf16Offset: beat.quoteStart, in: content) as String.Index?,
           start < content.endIndex,
           let end = content.index(start, offsetBy: beat.quote.count, limitedBy: content.endIndex),
           content[start..<end] == beat.quote {
            return start..<end
        }

        // Fallback: find it. Never highlight a range we have not verified.
        return content.range(of: beat.quote)
    }

    /// The entry text with the beat's quote emphasised in place.
    static func highlight(content: String, beat: Beat) -> AttributedString {
        var attributed = AttributedString(content)
        guard
            let stringRange = range(in: content, for: beat),
            let attributedRange = Range(stringRange, in: attributed)
        else { return attributed }

        attributed[attributedRange].backgroundColor =
            CognitiveMapTheme.color(for: beat.domain).opacity(0.22)
        attributed[attributedRange].inlinePresentationIntent = .stronglyEmphasized
        return attributed
    }
}

/// What a tapped beat opens: the beat, and the sentence it came from, in context.
struct BeatInspectorSheet: View {

    let beat: Beat
    let entryContent: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    header
                    Divider().overlay(Color.textSecondary.opacity(0.2))
                    Text(BeatQuoteHighlighter.highlight(content: entryContent, beat: beat))
                        .font(.journalBody)
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(Spacing.m)
            }
            .background(Color.appBackground)
            .navigationTitle("In your words")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text(beat.text)
                .font(.journalDetailTitle)
                .foregroundStyle(Color.textPrimary)

            HStack(spacing: Spacing.s) {
                Circle()
                    .fill(CognitiveMapTheme.color(for: beat.domain))
                    .frame(width: 8, height: 8)
                Text("\(beat.kind.rawValue.capitalized) · \(beat.domain.rawValue.capitalized)")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                if beat.isKeeper {
                    Text("Keeper")
                        .font(.captionText)
                        .foregroundStyle(Color.goldSurface)
                }
            }

            if !beat.mentions.isEmpty {
                Text(beat.mentions.map(\.surface).joined(separator: " · "))
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
