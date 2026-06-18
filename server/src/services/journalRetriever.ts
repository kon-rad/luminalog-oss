import { getJournalsCollection, resetJournalsCollection } from '../db/chroma'
import { embedQuery } from './aiClient'
import { decryptField } from '../crypto/fieldCipher'
import { config } from '../config'

const QUERY_MAX_CHARS = 2000
const TIMEOUT_MS = 10_000

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('RAG timeout')), TIMEOUT_MS),
    ),
  ])
}

/** A cached Chroma collection handle can outlive the collection (Chroma restart
 *  or a recreated collection during re-index) → query fails "not found". */
function isCollectionMissing(err: unknown): boolean {
  const s = `${(err as any)?.name ?? ''} ${(err as any)?.message ?? err}`
  return /NotFound|could not be found|does not exist/i.test(s)
}

async function runQuery(uid: string, q: string) {
  const queryEmbedding = await embedQuery(q)
  const col = await getJournalsCollection()
  return col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: config.RAG_TOP_K,
    where: { userId: { $eq: uid } },
    include: ['documents', 'metadatas', 'distances'] as any,
  })
}

export interface RagSource {
  journalId: string
  type: string
  date: string
  score: number
  title: string
  snippet: string
}

export interface RagResult {
  contextString: string
  sources: RagSource[]
}

export async function retrieveContextWithSources(uid: string, query: string, dek: Buffer): Promise<RagResult> {
  if (!uid) throw new Error('uid required for journal retrieval')

  const q = query.slice(-QUERY_MAX_CHARS)

  try {
    // The whole retrieval (embed + collection handle + query) is time-boxed —
    // previously only col.query() was, leaving the embed call able to hang.
    let results
    try {
      results = await withTimeout(runQuery(uid, q))
    } catch (err) {
      if (!isCollectionMissing(err)) throw err
      // Drop the stale handle and try once more against a fresh collection.
      resetJournalsCollection()
      results = await withTimeout(runQuery(uid, q))
    }

    const docs = results.documents?.[0] ?? []
    const metas = results.metadatas?.[0] ?? []
    const dists = (results as any).distances?.[0] ?? []

    const sources: RagSource[] = docs.map((doc, i) => {
      const m = (metas[i] ?? {}) as Record<string, unknown>
      const date = (m.indexedAt as string | undefined)?.slice(0, 10) ?? ''
      const snippet = decryptField(dek, JSON.parse(doc as string), `rag.chunk.${m.chunkIndex}`)
      const title = m.title ? decryptField(dek, JSON.parse(m.title as string), 'journals.title') : ''
      const distance = typeof dists[i] === 'number' ? dists[i] : 1
      return {
        journalId: (m.entryId as string) ?? '',
        type: (m.type as string) ?? '',
        date,
        score: Math.max(0, 1 - distance),
        title,
        snippet,
      }
    })

    const contextString = sources
      .map((s, i) => `[#${i + 1} — ${s.type} · ${s.title} · ${s.date}]\n${s.snippet}`)
      .join('\n\n')

    return { contextString, sources }
  } catch (err) {
    console.error('[journalRetriever] failed (returning empty context):', err)
    return { contextString: '', sources: [] }
  }
}

export async function retrieveContext(uid: string, query: string, dek: Buffer): Promise<string> {
  return (await retrieveContextWithSources(uid, query, dek)).contextString
}
