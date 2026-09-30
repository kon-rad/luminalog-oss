import { getJournalsCollection } from '../../db/chroma'

// Chroma (1.5.x, local) can briefly fail an embeddings read with
// "Error finding id" right after `indexEntryChunks` deletes and re-adds the same
// chunk ids: the metadata segment already lists them before the vector index has
// caught up. The identical read succeeds moments later, so retry briefly instead
// of dropping the day's constellation update.
const FINDING_ID_RETRY_DELAYS_MS = [150, 400, 1000]

function isFindingIdError(e: unknown): boolean {
  return e instanceof Error && e.message.includes('Error finding id')
}

export async function getWithFindingIdRetry<T>(
  read: () => Promise<T>,
  delaysMs: number[] = FINDING_ID_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read()
    } catch (e) {
      if (!isFindingIdError(e) || attempt >= delaysMs.length) throw e
      await new Promise(r => setTimeout(r, delaysMs[attempt]))
    }
  }
}

/**
 * Mean of a user's journal-text chunk embeddings for one calendar day, plus the
 * day's total word count (summed over DISTINCT entries — every chunk of an entry
 * repeats that entry's wordCount). Server-only: neither value is ever published.
 */
export async function computeDayCentroid(
  userId: string,
  dayIndex: number,
  /** Which chunk metadata holds the day: `dayIndex` (Soul Constellation, the
   *  default) or `localDayIndex` (zoom pyramid positions, profile timezone). */
  field: 'dayIndex' | 'localDayIndex' = 'dayIndex',
): Promise<{ centroid: number[]; wordTotal: number } | null> {
  const col = await getJournalsCollection()
  const res = await getWithFindingIdRetry(() => col.get({
    where: { $and: [{ userId: { $eq: userId } }, { [field]: { $eq: dayIndex } }] },
    include: ['embeddings', 'metadatas'] as any,
  }))
  const embs = (res.embeddings ?? []) as number[][]
  if (embs.length === 0) return null

  const d = embs[0].length
  const centroid = new Array<number>(d).fill(0)
  for (const e of embs) for (let j = 0; j < d; j++) centroid[j] += e[j]
  for (let j = 0; j < d; j++) centroid[j] /= embs.length

  const metas = (res.metadatas ?? []) as Array<{ entryId?: string; wordCount?: number }>
  const perEntry = new Map<string, number>()
  for (const m of metas) {
    if (m && typeof m.entryId === 'string') perEntry.set(m.entryId, (m.wordCount as number) ?? 0)
  }
  let wordTotal = 0
  for (const w of perEntry.values()) wordTotal += w

  return { centroid, wordTotal }
}
