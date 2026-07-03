import { getJournalsCollection } from '../../db/chroma'

/**
 * Mean of a user's journal-text chunk embeddings for one calendar day, plus the
 * day's total word count (summed over DISTINCT entries — every chunk of an entry
 * repeats that entry's wordCount). Server-only: neither value is ever published.
 */
export async function computeDayCentroid(
  userId: string,
  dayIndex: number,
): Promise<{ centroid: number[]; wordTotal: number } | null> {
  const col = await getJournalsCollection()
  const res = await col.get({
    where: { $and: [{ userId: { $eq: userId } }, { dayIndex: { $eq: dayIndex } }] },
    include: ['embeddings', 'metadatas'] as any,
  })
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
