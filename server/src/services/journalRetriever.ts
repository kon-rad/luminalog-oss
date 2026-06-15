import { getJournalsCollection } from '../db/chroma'
import { embed } from './aiClient'
import { decryptField } from '../crypto/fieldCipher'

const TOP_K = 20
const QUERY_MAX_CHARS = 2000
const TIMEOUT_MS = 10_000

export async function retrieveContext(uid: string, query: string, dek: Buffer): Promise<string> {
  if (!uid) throw new Error('uid required for journal retrieval')

  const q = query.slice(-QUERY_MAX_CHARS)

  try {
    const col = await getJournalsCollection()
    const [queryEmbedding] = await embed([q])

    const results = await Promise.race([
      col.query({
        queryEmbeddings: [queryEmbedding],
        nResults: TOP_K,
        where: { userId: { $eq: uid } },
        include: ['documents', 'metadatas'] as any,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Chroma timeout')), TIMEOUT_MS),
      ),
    ])

    const docs = results.documents?.[0] ?? []
    const metas = results.metadatas?.[0] ?? []
    if (docs.length === 0) return ''

    return docs
      .map((doc, i) => {
        const m = metas[i] as Record<string, unknown>
        const date = (m.indexedAt as string | undefined)?.slice(0, 10) ?? ''
        const text = decryptField(dek, JSON.parse(doc as string), `rag.chunk.${m.chunkIndex}`)
        const title = m.title ? decryptField(dek, JSON.parse(m.title as string), 'journals.title') : ''
        return `[#${i + 1} — ${m.type} · ${title} · ${date}]\n${text}`
      })
      .join('\n\n')
  } catch (err) {
    console.error('[journalRetriever] failed (returning empty context):', err)
    return ''
  }
}
