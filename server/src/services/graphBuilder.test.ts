import { vi, describe, it, expect, beforeEach } from 'vitest'

const col = {
  get: vi.fn(),
  query: vi.fn(),
  delete: vi.fn(),
  add: vi.fn(),
}
vi.mock('../db/chroma', () => ({
  getSummariesCollection: vi.fn(async () => col),
  resetSummariesCollection: vi.fn(),
}))
vi.mock('../crypto/fieldCipher', () => ({
  decryptField: (_k: Buffer, f: any) => f.ct,
}))

import { buildGraph, getGraph, invalidateGraph } from './graphBuilder'

const dek = Buffer.alloc(32)

// Three vectors: e1 and e2 nearly identical, e3 orthogonal.
function meta(entryId: string, date: string) {
  return { userId: 'u', entryId, type: 'text', title: JSON.stringify({ ct: `T-${entryId}` }), date }
}
function mockAllVectors() {
  col.get.mockResolvedValue({
    ids: ['u_e1', 'u_e2', 'u_e3'],
    embeddings: [
      [1, 0, 0],
      [0.99, 0.01, 0],
      [0, 0, 1],
    ],
    metadatas: [meta('e1', '2026-06-01'), meta('e2', '2026-06-02'), meta('e3', '2026-06-03')],
  })
}

describe('buildGraph', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns one node per entry with decrypted titles', async () => {
    mockAllVectors()
    const g = await buildGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    expect(g.nodes.map(n => n.id).sort()).toEqual(['e1', 'e2', 'e3'])
    const e1 = g.nodes.find(n => n.id === 'e1')!
    expect(e1.title).toBe('T-e1')
    expect(e1.date).toBe('2026-06-01')
    expect(e1.type).toBe('text')
  })

  it('links similar entries above the floor and excludes dissimilar ones', async () => {
    mockAllVectors()
    const g = await buildGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    // e1<->e2 are ~identical (cosine ~1) → linked; e3 is orthogonal (cosine 0 < 0.5) → no edges.
    expect(g.links).toHaveLength(1)
    const [link] = g.links
    expect([link.source, link.target].sort()).toEqual(['e1', 'e2'])
    expect(link.value).toBeGreaterThan(0.9)
  })

  it('dedupes undirected edges (A->B and B->A become one)', async () => {
    mockAllVectors()
    const g = await buildGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    expect(g.links).toHaveLength(1) // not 2
  })

  it('sets node degree from incident edges', async () => {
    mockAllVectors()
    const g = await buildGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    expect(g.nodes.find(n => n.id === 'e1')!.degree).toBe(1)
    expect(g.nodes.find(n => n.id === 'e3')!.degree).toBe(0)
  })

  it('returns empty graph for a user with no entries', async () => {
    col.get.mockResolvedValue({ ids: [], embeddings: [], metadatas: [] })
    const g = await buildGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    expect(g).toEqual({ nodes: [], links: [] })
  })

  it('queries Chroma filtered by userId (no cross-tenant leakage)', async () => {
    mockAllVectors()
    await buildGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    expect(col.get).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { $eq: 'u' } } }),
    )
  })
})

describe('getGraph / invalidateGraph cache', () => {
  beforeEach(() => { vi.clearAllMocks(); invalidateGraph('u') })

  it('caches the first build and serves the second from cache', async () => {
    mockAllVectors()
    const a = await getGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    const b = await getGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    expect(b).toBe(a)            // same reference → served from cache
    expect(col.get).toHaveBeenCalledTimes(1)
  })

  it('rebuilds after invalidateGraph', async () => {
    mockAllVectors()
    await getGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    invalidateGraph('u')
    await getGraph({ userId: 'u', dek, topK: 4, minSimilarity: 0.5, maxDegree: 12 })
    expect(col.get).toHaveBeenCalledTimes(2)
  })
})
