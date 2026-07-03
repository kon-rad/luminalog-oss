import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
vi.mock('../../db/chroma', () => ({
  getJournalsCollection: async () => ({ get }),
}))

import { computeDayCentroid } from './dayCentroid'

beforeEach(() => get.mockReset())

describe('computeDayCentroid', () => {
  it('averages the day\'s chunk embeddings', async () => {
    get.mockResolvedValue({ embeddings: [[0, 0, 0], [2, 4, 6]] })
    expect(await computeDayCentroid('u1', 20272)).toEqual([1, 2, 3])
  })

  it('returns null when the day has no chunks', async () => {
    get.mockResolvedValue({ embeddings: [] })
    expect(await computeDayCentroid('u1', 20272)).toBeNull()
  })

  it('filters by userId and dayIndex and includes embeddings', async () => {
    get.mockResolvedValue({ embeddings: [[1, 1]] })
    await computeDayCentroid('u1', 42)
    expect(get).toHaveBeenCalledWith({
      where: { $and: [{ userId: { $eq: 'u1' } }, { dayIndex: { $eq: 42 } }] },
      include: ['embeddings'],
    })
  })
})
