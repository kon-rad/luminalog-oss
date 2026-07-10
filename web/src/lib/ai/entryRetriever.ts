// Keyword + recency retriever — the hybrid fallback when semantic search is
// unavailable (model not loaded / empty index). Mirrors iOS `EntryRetriever`:
// per-distinct-term binary presence (coverage, not frequency) weighted title 3.0
// / content 1.0, plus a small recency boost 0.5/(1+ageDays) that only breaks
// ties. Empty query → most-recent K. Tie-break ascending id. Tokenization folds
// case + diacritics and splits on non-alphanumerics.

export interface RetrievableEntry {
  id: string
  title: string
  content: string
  createdAt: Date
}

export interface ScoredRetrievable {
  entry: RetrievableEntry
  score: number
}

const TITLE_WEIGHT = 3.0
const CONTENT_WEIGHT = 1.0

/** Case+diacritic-fold and split into a set of terms. Splits on ASCII
 * whitespace/punctuation while keeping non-ASCII letters (Cyrillic, CJK, …) as
 * tokens — a reasonable multilingual fallback without the regex `u` flag. */
function tokenize(text: string): Set<string> {
  const folded = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
  return new Set(folded.split(/[^0-9a-zÀ-￿]+/).filter(Boolean))
}

function recencyBoost(createdAt: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / 86_400_000)
  return 0.5 / (1 + ageDays)
}

export function topKByKeyword(
  k: number,
  query: string,
  entries: RetrievableEntry[],
  now: Date = new Date(),
): ScoredRetrievable[] {
  if (k <= 0) return []
  const terms = tokenize(query)

  const scored: ScoredRetrievable[] = entries.map((entry) => {
    let keyword = 0
    if (terms.size > 0) {
      const titleTerms = tokenize(entry.title)
      const contentTerms = tokenize(entry.content)
      terms.forEach((term) => {
        if (titleTerms.has(term)) keyword += TITLE_WEIGHT
        if (contentTerms.has(term)) keyword += CONTENT_WEIGHT
      })
    }
    return { entry, score: keyword + recencyBoost(entry.createdAt, now) }
  })

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.entry.id < b.entry.id ? -1 : 1))
  return scored.slice(0, k)
}
