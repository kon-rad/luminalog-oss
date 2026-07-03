import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
vi.mock('../../db/chroma', () => ({
  getJournalsCollection: async () => ({ get }),
}))

import { computeDayCentroid } from './dayCentroid'

beforeEach(() => get.mockReset())

describe('computeDayCentroid', () => {
  it('averages embeddings and sums distinct-entry word counts', async () => {
    // entry A: 2 chunks (wordCount 400 each occurrence), entry B: 1 chunk (350)
    get.mockResolvedValue({
      embeddings: [[0, 0, 0], [2, 4, 6], [4, 2, 0]],
      metadatas: [
        { entryId: 'A', wordCount: 400 },
        { entryId: 'A', wordCount: 400 },
        { entryId: 'B', wordCount: 350 },
      ],
    })
    const res = await computeDayCentroid('u1', 20272)
    expect(res).not.toBeNull()
    expect(res!.centroid).toEqual([2, 2, 2]) // (0+2+4)/3, (0+4+2)/3, (0+6+0)/3
    expect(res!.wordTotal).toBe(750) // 400 (A, once) + 350 (B), not 1150
  })

  it('returns null when the day has no chunks', async () => {
    get.mockResolvedValue({ embeddings: [], metadatas: [] })
    expect(await computeDayCentroid('u1', 20272)).toBeNull()
  })

  it('filters by userId and dayIndex and includes embeddings + metadatas', async () => {
    get.mockResolvedValue({ embeddings: [[1, 1]], metadatas: [{ entryId: 'A', wordCount: 10 }] })
    await computeDayCentroid('u1', 42)
    expect(get).toHaveBeenCalledWith({
      where: { $and: [{ userId: { $eq: 'u1' } }, { dayIndex: { $eq: 42 } }] },
      include: ['embeddings', 'metadatas'],
    })
  })
})
