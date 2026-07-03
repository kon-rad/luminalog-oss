import { getJournalsCollection } from '../../db/chroma'

/**
 * Mean of all of a user's journal-text chunk embeddings for one calendar day.
 * Server-only: the returned vector is cached but never published.
 */
export async function computeDayCentroid(
  userId: string,
  dayIndex: number,
): Promise<number[] | null> {
  const col = await getJournalsCollection()
  const res = await col.get({
    where: { $and: [{ userId: { $eq: userId } }, { dayIndex: { $eq: dayIndex } }] },
    include: ['embeddings'] as any,
  })
  const embs = (res.embeddings ?? []) as number[][]
  if (embs.length === 0) return null

  const d = embs[0].length
  const mean = new Array<number>(d).fill(0)
  for (const e of embs) for (let j = 0; j < d; j++) mean[j] += e[j]
  for (let j = 0; j < d; j++) mean[j] /= embs.length
  return mean
}
