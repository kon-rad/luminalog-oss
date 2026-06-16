import { getJournalsCollection, resetJournalsCollection } from '../db/chroma'
import { embed } from './aiClient'
import { encryptField } from '../crypto/fieldCipher'
import { config } from '../config'

// Short entries are stored as a single chunk rather than being split.
const SHORT_THRESHOLD = 500

function chunk(text: string, chunkSize: number, chunkOverlap: number): string[] {
  if (text.length <= SHORT_THRESHOLD) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    if (end === text.length) break
    start += chunkSize - chunkOverlap
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
  dek: Buffer
}): Promise<{ chunks: number }> {
  const { userId, entryId, content, title, type, updatedAt, dek } = params
  if (!userId) throw new Error('userId required')

  try {
    await purgeChunks(userId, entryId)

    const chunks = chunk(content, config.RAG_CHUNK_SIZE, config.RAG_CHUNK_OVERLAP)
    if (chunks.length === 0) return { chunks: 0 }

    const embeddings = await embed(chunks)
    const col = await getJournalsCollection()

    const encTitle = JSON.stringify(encryptField(dek, title, 'journals.title'))
    await col.add({
      ids: chunks.map((_, i) => `${userId}_${entryId}_chunk_${i}`),
      embeddings,
      documents: chunks.map((c, i) => JSON.stringify(encryptField(dek, c, `rag.chunk.${i}`))),
      metadatas: chunks.map((_, i) => ({
        userId,
        entryId,
        title: encTitle,
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
