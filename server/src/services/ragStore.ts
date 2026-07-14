import { Collection } from 'chromadb'
import { getJournalsCollection, resetJournalsCollection } from '../db/chroma'
import { embed } from './aiClient'

/** True for errors indicating our cached collection handle is stale — e.g. the
 *  collection was deleted + recreated (a new UUID) out from under us, so Chroma
 *  reports NotFound for the old handle. */
function isCollectionNotFound(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? ''
  const msg = (err as { message?: string })?.message ?? ''
  return /NotFound|could not be found|does not exist/i.test(`${name} ${msg}`)
}

/**
 * Run a Chroma op against the journals collection. If the cached collection handle
 * is stale (NotFound — the collection was wiped/recreated), drop the cache and retry
 * ONCE with a fresh handle. This makes index/search self-heal after a collection
 * wipe (e.g. the 512→1024-dim migration) without a server restart.
 */
async function withJournalsCollection<T>(op: (col: Collection) => Promise<T>): Promise<T> {
  try {
    return await op(await getJournalsCollection())
  } catch (err) {
    if (!isCollectionNotFound(err)) throw err
    resetJournalsCollection()
    return await op(await getJournalsCollection())
  }
}

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

/** Delete all of an entry's chunk rows (idempotent, userId-scoped). */
export async function deleteEntryChunks(userId: string, entryId: string): Promise<void> {
  await withJournalsCollection(col =>
    col.delete({
      where: { $and: [{ userId: { $eq: userId } }, { entryId: { $eq: entryId } }] },
    }),
  )
}

/**
 * Re-index an entry: purge its old chunks, embed the new chunks via the active
 * provider (Morpheus BGE-M3 when AI_PROVIDER=morpheus), and add one row per chunk.
 * Rows carry NO text — only the vector + metadata. Deterministic ids make it a
 * clean replace. Returns the number of chunks indexed.
 */
export async function indexEntryChunks(p: IndexChunksParams): Promise<number> {
  if (p.chunks.length === 0) {
    await deleteEntryChunks(p.userId, p.entryId)
    return 0
  }
  // Embed ONCE (expensive) outside the collection retry.
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
  // Purge old chunks + add new ones as one unit, so a stale-collection reset
  // retries both together (a clean replace).
  await withJournalsCollection(async col => {
    await col.delete({
      where: { $and: [{ userId: { $eq: p.userId } }, { entryId: { $eq: p.entryId } }] },
    })
    await col.add({ ids, embeddings, metadatas })
  })
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
  const [queryEmbedding] = await embed([queryText])
  const res = await withJournalsCollection(col =>
    col.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      where: { userId: { $eq: userId } },
      include: ['metadatas', 'distances'] as any,
    }),
  )
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
