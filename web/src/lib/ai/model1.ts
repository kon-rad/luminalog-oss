// Assembles the plaintext journal RAG context sent to the Model-1 AI endpoints,
// mirroring iOS `Model1Requests.journalContext` + the server `journalRetriever`.
// Semantic-first: if a searcher returns entry ids, resolve + format them in
// ranked order; otherwise fall back to the keyword+recency ranker ("never worse
// than today"). The formatted block is byte-identical across both paths and
// across platforms:
//     [#i — <type> · <title> · <yyyy-MM-dd UTC>]\n<snippet(≤snippetChars)>
// joined by blank lines.

import { topKByKeyword, type RetrievableEntry } from '@/lib/ai/entryRetriever'

export interface ContextEntry extends RetrievableEntry {
  type: string
}

export interface Searcher {
  search(query: string, k: number): Promise<{ entryId: string; score: number }[]>
}

export interface JournalContextOptions {
  searcher?: Searcher
  topK?: number
  snippetChars?: number
}

interface FormattableEntry {
  type: string
  title: string
  createdAt: Date
  content: string
}

/** yyyy-MM-dd in UTC (matches the server's UTC date formatting). */
function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatContext(ranked: FormattableEntry[], snippetChars: number): string {
  return ranked
    .map((e, i) => {
      const snippet = e.content.slice(0, snippetChars)
      return `[#${i + 1} — ${e.type} · ${e.title} · ${utcDate(e.createdAt)}]\n${snippet}`
    })
    .join('\n\n')
}

export async function journalContext(
  query: string,
  entries: ContextEntry[],
  opts: JournalContextOptions = {},
): Promise<string> {
  const topK = opts.topK ?? 5
  const snippetChars = opts.snippetChars ?? 500

  if (opts.searcher) {
    const hits = await opts.searcher.search(query, topK)
    if (hits.length > 0) {
      const byId = new Map(entries.map((e) => [e.id, e]))
      const ranked = hits.map((h) => byId.get(h.entryId)).filter((e): e is ContextEntry => e !== undefined)
      if (ranked.length > 0) return formatContext(ranked, snippetChars)
    }
  }

  // Keyword + recency fallback.
  const ranked = topKByKeyword(topK, query, entries, new Date()).map((r) => r.entry as ContextEntry)
  return formatContext(ranked, snippetChars)
}
