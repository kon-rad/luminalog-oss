import Foundation

/// Fully client-side keyword + recency retrieval over the user's already-decrypted
/// journal entries. This is increment 1c-A of the zero-knowledge migration: the
/// plaintext entries live in memory (decrypted via the existing repo/`UserKeyStore`),
/// and this type ranks them locally so the top-K can feed RAG context under Model 1.
///
/// It is a **pure** value: no networking, no Firestore, no crypto, no global state,
/// and — importantly for deterministic tests — it never calls `Date()` internally.
/// The caller injects `now`.
///
/// Semantic/embedding search is a *later* increment (1c-D); this module deliberately
/// does keyword overlap + a mild recency boost only.
///
/// ## Scoring (simple and documented)
/// For a non-empty query, each entry gets:
///
///   score = keywordScore + recencyBoost
///
/// * `keywordScore` — tokenize the query and the entry's title + content
///   (case-folded and diacritic-folded), then for every **distinct** query term that
///   appears, add `titleWeight` if it is present in the title and `contentWeight` if
///   it is present in the content. Presence is binary per field (a term counts once
///   per field regardless of how often it repeats), so distinct-term *coverage*
///   drives the score: an entry matching more *different* query terms outranks one
///   that merely repeats a single term. Title matches are weighted higher than body
///   matches (`titleWeight` > `contentWeight`).
///
/// * `recencyBoost` — a mild secondary factor in the half-open range `[0, 0.5)`,
///   computed as `0.5 / (1 + ageInDays)` from `createdAt` relative to `now`. Because
///   keyword scores differ by whole units of at least `contentWeight` (>= 1), a boost
///   capped below 1 can only ever break ties between entries of equal keyword
///   relevance (newer wins) — it never reorders entries that differ on keywords.
///
/// Final ties (identical score) break on `id` for stable, deterministic output.
struct EntryRetriever {

    /// Weight applied to a query-term occurrence in the entry title.
    let titleWeight: Double
    /// Weight applied to a query-term occurrence in the entry content/body.
    let contentWeight: Double

    init(titleWeight: Double = 3.0, contentWeight: Double = 1.0) {
        self.titleWeight = titleWeight
        self.contentWeight = contentWeight
    }

    /// Returns the top-`k` most relevant entries for `query`.
    ///
    /// Behaviour at the edges (documented, deterministic):
    /// * `k <= 0` → `[]`.
    /// * `k` greater than the corpus → all entries, ranked.
    /// * Empty query, or a whitespace/punctuation-only query that tokenizes to
    ///   nothing → the most-recent `k` entries (pure recency order).
    /// * Matching is case-insensitive and diacritic-insensitive
    ///   ("café" matches "cafe", "JOURNAL" matches "journal").
    ///
    /// - Parameters:
    ///   - k: Maximum number of entries to return.
    ///   - query: The free-text query.
    ///   - entries: The user's decrypted entries (plaintext, in memory).
    ///   - now: The reference time for the recency factor (injected for determinism).
    func topK(_ k: Int, matching query: String, in entries: [JournalEntry], now: Date) -> [JournalEntry] {
        guard k > 0, !entries.isEmpty else { return [] }

        let queryTerms = Set(Self.tokenize(query))

        // Empty / whitespace / punctuation-only query → most-recent K.
        guard !queryTerms.isEmpty else {
            let byRecency = entries.sorted { lhs, rhs in
                if lhs.createdAt != rhs.createdAt { return lhs.createdAt > rhs.createdAt }
                return lhs.id < rhs.id
            }
            return Array(byRecency.prefix(k))
        }

        let scored: [(entry: JournalEntry, score: Double)] = entries.map { entry in
            (entry, score(for: entry, queryTerms: queryTerms, now: now))
        }

        let ranked = scored.sorted { lhs, rhs in
            if lhs.score != rhs.score { return lhs.score > rhs.score }
            return lhs.entry.id < rhs.entry.id
        }

        return ranked.prefix(k).map(\.entry)
    }

    // MARK: - Scoring

    private func score(for entry: JournalEntry, queryTerms: Set<String>, now: Date) -> Double {
        let titleTerms = Set(Self.tokenize(entry.title))
        let contentTerms = Set(Self.tokenize(entry.content))

        // Binary presence per field per distinct query term: coverage, not frequency.
        var keywordScore = 0.0
        for term in queryTerms {
            if titleTerms.contains(term) { keywordScore += titleWeight }
            if contentTerms.contains(term) { keywordScore += contentWeight }
        }

        return keywordScore + Self.recencyBoost(createdAt: entry.createdAt, now: now)
    }

    /// Mild recency boost in `[0, 0.5)` — always dominated by any keyword-score
    /// difference (which is a whole multiple of `contentWeight` >= 1), so it only
    /// breaks ties between equally-relevant entries in favour of the newer one.
    static func recencyBoost(createdAt: Date, now: Date) -> Double {
        let ageSeconds = max(0, now.timeIntervalSince(createdAt))
        let ageDays = ageSeconds / 86_400
        return 0.5 / (1 + ageDays)
    }

    // MARK: - Tokenization

    /// Case- and diacritic-folded tokens: split on any non-alphanumeric character so
    /// punctuation and whitespace are separators, and unicode letters/digits survive.
    static func tokenize(_ text: String) -> [String] {
        let folded = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
        return folded
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
    }
}
