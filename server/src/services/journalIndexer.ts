import { getJournalsCollection, resetJournalsCollection } from '../db/chroma'
import { embed } from './aiClient'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200
const SHORT_THRESHOLD = 500

function chunk(text: string): string[] {
  if (text.length <= SHORT_THRESHOLD) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end))
    if (end === text.length) break
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks
}

async function purgeChunks(userId: string, entryId: string): Promise<void> {
  const col = await getJournalsCollection()
  const existing = await col.get({
    where: { $and: [{ userId: { $eq: userId } }, { entryId: { $eq: entryId } }] },
  })
  if (existing.ids.length > 0) {
    await col.delete({ ids: existing.ids })
  }
}

export async function indexJournalEntry(params: {
  userId: string
  entryId: string
  content: string
  title: string
  type: string
  updatedAt: string
}): Promise<{ chunks: number }> {
  const { userId, entryId, content, title, type, updatedAt } = params
  if (!userId) throw new Error('userId required')

  try {
    await purgeChunks(userId, entryId)

    const chunks = chunk(content)
    if (chunks.length === 0) return { chunks: 0 }

    const embeddings = await embed(chunks)
    const col = await getJournalsCollection()

    await col.add({
      ids: chunks.map((_, i) => `${userId}_${entryId}_chunk_${i}`),
      embeddings,
      documents: chunks,
      metadatas: chunks.map((_, i) => ({
        userId,
        entryId,
        title,
        type,
        chunkIndex: i,
        totalChunks: chunks.length,
        indexedAt: updatedAt,
      })),
    })

    return { chunks: chunks.length }
  } catch (err) {
    resetJournalsCollection()
    throw err
  }
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId) throw new Error('userId required')
  await purgeChunks(userId, entryId)
}
