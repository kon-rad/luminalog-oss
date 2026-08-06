import Foundation
import NaturalLanguage

/// Computes word frequencies across journal text, fully on-device.
/// Pipeline: tokenize → lemmatize → part-of-speech filter (keep nouns, verbs,
/// adjectives) → stop-word filter → count → top N. See ADR-0032.
enum WordFrequencyAnalyzer {

    /// Lexical classes worth keeping — the words a journal is "about".
    private static let keptClasses: Set<NLTag> = [.noun, .verb, .adjective]

    /// Common filler the POS filter doesn't catch.
    private static let stopWords: Set<String> = [
        "be", "have", "do", "go", "get", "make", "say", "thing", "get", "got",
        "really", "very", "just", "today", "yesterday", "tomorrow", "feel",
        "felt", "lot", "bit", "way", "time", "day", "want", "know", "think",
        "i", "me", "my", "we", "us", "you", "it", "is", "am", "the", "a", "and",
        "to", "of", "in", "on", "for", "with", "will", "would", "can", "could"
    ]

    /// Top words across a set of entries' canonical text.
    static func topWords(from entries: [JournalEntry], limit: Int = 50) -> [WordFrequency] {
        let combined = entries.map(\.content).joined(separator: "\n")
        return topWords(in: combined, limit: limit)
    }

    /// Top words in a single string (directly unit-testable).
    static func topWords(in text: String, limit: Int = 50) -> [WordFrequency] {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }

        // POS-filtered pass first (keeps only nouns/verbs/adjectives). On a runtime
        // without the linguistic models (notably a bare Simulator) the part-of-speech
        // tagger classifies everything as `.other`, which the filter drops — so if the
        // filtered pass finds nothing, fall back to a POS-free pass that relies on the
        // length + stop-word filters alone. Real devices/CI keep the POS filtering.
        var counts = count(in: text, applyPOS: true)
        if counts.isEmpty {
            counts = count(in: text, applyPOS: false)
        }

        return counts
            .sorted { ($0.value, $1.key) > ($1.value, $0.key) } // count desc, then word asc
            .prefix(limit)
            .map { WordFrequency(word: $0.key, count: $0.value) }
    }

    /// Tokenize `text` and count kept words. When `applyPOS` is true a token is
    /// dropped unless its lexical class is a noun/verb/adjective; when false the POS
    /// filter is skipped (the model-unavailable fallback). Tokenization uses
    /// `NLTokenizer` (rule-based, always available) so tokens are produced regardless
    /// of whether the tagging models are installed.
    private static func count(in text: String, applyPOS: Bool) -> [String: Int] {
        var counts: [String: Int] = [:]
        let tagger = NLTagger(tagSchemes: [.lemma, .lexicalClass])
        tagger.string = text
        let tokenizer = NLTokenizer(unit: .word)
        tokenizer.string = text

        tokenizer.enumerateTokens(in: text.startIndex..<text.endIndex) { range, _ in
            if applyPOS {
                let posTag = tagger.tag(at: range.lowerBound, unit: .word, scheme: .lexicalClass).0
                guard let posTag, keptClasses.contains(posTag) else { return true }
            }

            // Prefer the lemma; fall back to the lowercased surface form.
            let lemma = tagger.tag(at: range.lowerBound, unit: .word, scheme: .lemma).0?.rawValue
            let raw = String(text[range]).lowercased()
            let word = (lemma?.isEmpty == false ? lemma!.lowercased() : raw)

            guard word.count >= 3, !stopWords.contains(word),
                  word.first?.isLetter == true else { return true }

            counts[word, default: 0] += 1
            return true
        }
        return counts
    }
}
