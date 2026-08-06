import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
vi.mock('../db/chroma', () => ({
  getJournalsCollection: async () => ({ get }),
}))

import { computeJournalGraph } from './ragGraph'

beforeEach(() => get.mockReset())

describe('computeJournalGraph', () => {
  it('reduces chunks to per-entry centroids and links nearest neighbours', async () => {
    // A and B point the same way (parallel) → most similar to each other.
    // C is orthogonal to both. A has two chunks averaging to [1,0].
    get.mockResolvedValue({
      embeddings: [
        [2, 0], // A chunk 0
        [0, 0], // A chunk 1  → centroid [1,0]
        [5, 0], // B          → centroid [5,0] (same direction as A)
        [0, 3], // C          → centroid [0,3] (orthogonal)
      ],
      metadatas: [
        { entryId: 'A' },
        { entryId: 'A' },
        { entryId: 'B' },
        { entryId: 'C' },
      ],
    })

    const g = await computeJournalGraph('u1', 1)
    expect(g.nodes.sort()).toEqual(['A', 'B', 'C'])

    // With k=1 each node connects to its single best neighbour; A↔B are parallel
    // (cosine 1), so that edge must exist and be strongest.
    const ab = g.edges.find(e => e.a === 'A' && e.b === 'B')
    expect(ab).toBeDefined()
    expect(ab!.score).toBeCloseTo(1, 5)
  })

  it('scopes the query to the userId', async () => {
    get.mockResolvedValue({ embeddings: [], metadatas: [] })
    await computeJournalGraph('u9')
    expect(get).toHaveBeenCalledWith({
      where: { userId: { $eq: 'u9' } },
      include: ['embeddings', 'metadatas'],
    })
  })

  it('returns no edges for fewer than two entries', async () => {
    get.mockResolvedValue({ embeddings: [[1, 2, 3]], metadatas: [{ entryId: 'solo' }] })
    const g = await computeJournalGraph('u1')
    expect(g.nodes).toEqual(['solo'])
    expect(g.edges).toEqual([])
  })

  it('de-duplicates undirected edges (A→B and B→A become one)', async () => {
    get.mockResolvedValue({
      embeddings: [[1, 0], [1, 0]], // identical → mutually nearest
      metadatas: [{ entryId: 'A' }, { entryId: 'B' }],
    })
    const g = await computeJournalGraph('u1', 3)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toMatchObject({ a: 'A', b: 'B' })
  })
})
