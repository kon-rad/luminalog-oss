import { getSummariesCollection, resetSummariesCollection } from '../db/chroma'
import { embed } from './aiClient'
import { encryptField, decryptField } from '../crypto/fieldCipher'

function vectorId(userId: string, entryId: string): string {
  return `${userId}_${entryId}`
}

async function purge(userId: string, entryId: string): Promise<void> {
  const col = await getSummariesCollection()
  const existing = await col.get({ ids: [vectorId(userId, entryId)] })
  if (existing.ids.length > 0) await col.delete({ ids: existing.ids })
}

export async function indexSummary(params: {
  userId: string
  entryId: string
  summaryText: string
  type: string
  title: string
  date: string
  dek: Buffer
}): Promise<void> {
  const { userId, entryId, summaryText, type, title, date, dek } = params
  if (!userId) throw new Error('userId required')
  try {
    await purge(userId, entryId)
    const [embedding] = await embed([summaryText])
    const col = await getSummariesCollection()
    await col.add({
      ids: [vectorId(userId, entryId)],
      embeddings: [embedding],
      documents: [JSON.stringify(encryptField(dek, summaryText, 'rag.summary'))],
      metadatas: [{
        userId,
        entryId,
        type,
        title: JSON.stringify(encryptField(dek, title, 'journals.title')),
        date,
      }],
    })
  } catch (err) {
    resetSummariesCollection()
    throw err
  }
}

export async function deleteSummary(userId: string, entryId: string): Promise<void> {
  if (!userId) throw new Error('userId required')
  await purge(userId, entryId)
}

export interface RelatedEntry {
  journalId: string
  title: string
  type: string
  date: string
  snippet: string
  score: number
}

export async function findRelated(params: {
  userId: string
  entryId: string
  limit: number
  dek: Buffer
}): Promise<RelatedEntry[]> {
  const { userId, entryId, limit, dek } = params
  if (!userId) throw new Error('userId required')

  const col = await getSummariesCollection()

  const self = await col.get({ ids: [vectorId(userId, entryId)], include: ['embeddings'] as any })
  const selfVec = self.embeddings?.[0]
  if (!selfVec) return []

  const results = await col.query({
    queryEmbeddings: [selfVec],
    nResults: limit + 1, // +1 to drop self
    where: { userId: { $eq: userId } },
    include: ['documents', 'metadatas', 'distances'] as any,
  })

  const ids = results.ids?.[0] ?? []
  const docs = results.documents?.[0] ?? []
  const metas = results.metadatas?.[0] ?? []
  const dists = (results as any).distances?.[0] ?? []

  const out: RelatedEntry[] = []
  for (let i = 0; i < ids.length; i++) {
    const m = metas[i] as Record<string, unknown>
    if (m.entryId === entryId) continue // exclude self
    const title = m.title ? decryptField(dek, JSON.parse(m.title as string), 'journals.title') : ''
    const snippet = docs[i] ? decryptField(dek, JSON.parse(docs[i] as string), 'rag.summary') : ''
    out.push({
      journalId: m.entryId as string,
      title,
      type: (m.type as string) ?? 'text',
      date: (m.date as string) ?? '',
      snippet,
      score: typeof dists[i] === 'number' ? 1 - dists[i] : 0,
    })
    if (out.length >= limit) break
  }
  return out
}
