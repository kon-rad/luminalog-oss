import { getJournalsCollection } from '../db/chroma'
import { embed } from './aiClient'

// Bump when the CLIENT chunker algorithm changes so stale-chunked entries can be
// re-indexed. Stored on every row's metadata.
export const CHUNKER_VERSION = 1

export interface IndexChunksParams {
  userId: string
  entryId: string
  type: string
  dayIndex: number
  wordCount: number
  chunks: string[]
}

export interface ChunkHit {
  entryId: string
  chunkIndex: number
  score: number
}

function chunkId(userId: string, entryId: string, i: number): string {
  return `${userId}__${entryId}__${i}`
}

function entryScope(userId: string, entryId: string) {
  return { where: { $and: [{ userId: { $eq: userId } }, { entryId: { $eq: entryId } }] } }
}

/** Delete all of an entry's chunk rows (idempotent, userId-scoped). */
export async function deleteEntryChunks(userId: string, entryId: string): Promise<void> {
  const col = await getJournalsCollection()
  await col.delete(entryScope(userId, entryId))
}

/**
 * Re-index an entry: purge its old chunks, embed the new chunks via the active
 * provider (Morpheus BGE-M3 when AI_PROVIDER=morpheus), and add one row per chunk.
 * Rows carry NO text — only the vector + metadata. Deterministic ids make it a
 * clean replace. Returns the number of chunks indexed.
 */
export async function indexEntryChunks(p: IndexChunksParams): Promise<number> {
  const col = await getJournalsCollection()
  await deleteEntryChunks(p.userId, p.entryId)
  if (p.chunks.length === 0) return 0
  const embeddings = await embed(p.chunks)
  const ids = p.chunks.map((_, i) => chunkId(p.userId, p.entryId, i))
  const metadatas = p.chunks.map((_, i) => ({
    userId: p.userId,
    entryId: p.entryId,
    chunkIndex: i,
    chunkerVersion: CHUNKER_VERSION,
    type: p.type,
    dayIndex: p.dayIndex,
    wordCount: p.wordCount,
  }))
  await col.add({ ids, embeddings, metadatas })
  return p.chunks.length
}

/**
 * Embed the query, cosine ANN over the caller's chunks only, and return chunk
 * references (never text). Cosine distance is mapped to a [0,1] similarity score.
 */
export async function searchChunks(
  userId: string,
  queryText: string,
  topK: number,
): Promise<ChunkHit[]> {
  const col = await getJournalsCollection()
  const [queryEmbedding] = await embed([queryText])
  const res = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    where: { userId: { $eq: userId } },
    include: ['metadatas', 'distances'] as any,
  })
  const metas = (res.metadatas?.[0] ?? []) as Array<{ entryId?: string; chunkIndex?: number }>
  const dists = (res.distances?.[0] ?? []) as number[]
  return metas
    .map((m, i) => ({
      entryId: String(m?.entryId ?? ''),
      chunkIndex: Number(m?.chunkIndex ?? 0),
      score: 1 - (dists[i] ?? 1),
    }))
    .filter(h => h.entryId)
}
