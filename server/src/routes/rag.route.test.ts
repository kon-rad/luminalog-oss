import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../services/ragStore', () => ({
  indexEntryChunks: vi.fn(async () => 2),
  deleteEntryChunks: vi.fn(async () => {}),
  searchChunks: vi.fn(async () => [{ entryId: 'e1', chunkIndex: 0, score: 0.9 }]),
  getEntryDayIndex: vi.fn(async () => 42),
}))
vi.mock('../services/constellation/constellationService', () => ({
  updateConstellationForDay: vi.fn(async () => {}),
}))
vi.mock('../services/ragGraph', () => ({
  computeJournalGraph: vi.fn(async () => ({ nodes: ['e1', 'e2'], edges: [{ a: 'e1', b: 'e2', score: 0.8 }] })),
}))
// The route module imports auth/consent middleware at load time; stub them so the
// handlers can be exercised directly without Firebase.
vi.mock('../middleware/firebaseAuth', () => ({ firebaseAuth: vi.fn(), db: {} }))
vi.mock('../middleware/requireAiConsent', () => ({ requireAiConsent: vi.fn() }))

import { indexHandler, deleteHandler, searchHandler, graphHandler } from './rag'
import { indexEntryChunks, deleteEntryChunks, searchChunks, getEntryDayIndex } from '../services/ragStore'
import { updateConstellationForDay } from '../services/constellation/constellationService'
import { computeJournalGraph } from '../services/ragGraph'

function mockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}
beforeEach(() => { vi.clearAllMocks() })

describe('indexHandler', () => {
  it('400s when chunks is not a string array', async () => {
    const res = mockRes()
    await indexHandler({ uid: 'u1', body: { entryId: 'e1', chunks: 'nope' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(indexEntryChunks).not.toHaveBeenCalled()
  })

  it('indexes with uid from the token (not the body) and returns count', async () => {
    const res = mockRes()
    await indexHandler(
      { uid: 'u1', body: { entryId: 'e1', type: 'text', dayIndex: 5, wordCount: 12, userId: 'ATTACKER', chunks: ['a', 'b'] } } as any,
      res,
    )
    expect(indexEntryChunks).toHaveBeenCalledWith({
      userId: 'u1', entryId: 'e1', type: 'text', dayIndex: 5, wordCount: 12, chunks: ['a', 'b'],
    })
    expect(res.json).toHaveBeenCalledWith({ ok: true, entryId: 'e1', chunks: 2 })
  })

  it('refreshes the constellation for the indexed day', async () => {
    const res = mockRes()
    await indexHandler(
      { uid: 'u1', body: { entryId: 'e1', dayIndex: 5, chunks: ['a'] } } as any,
      res,
    )
    expect(updateConstellationForDay).toHaveBeenCalledWith('u1', 5)
  })

  it('still succeeds when the constellation refresh throws (non-fatal)', async () => {
    ;(updateConstellationForDay as any).mockRejectedValueOnce(new Error('boom'))
    const res = mockRes()
    await indexHandler(
      { uid: 'u1', body: { entryId: 'e1', dayIndex: 5, chunks: ['a'] } } as any,
      res,
    )
    expect(res.json).toHaveBeenCalledWith({ ok: true, entryId: 'e1', chunks: 2 })
  })
})

describe('deleteHandler', () => {
  it('deletes the entry’s chunks for the caller and recomputes its day', async () => {
    const res = mockRes()
    await deleteHandler({ uid: 'u1', params: { entryId: 'e9' } } as any, res)
    expect(getEntryDayIndex).toHaveBeenCalledWith('u1', 'e9')
    expect(deleteEntryChunks).toHaveBeenCalledWith('u1', 'e9')
    expect(updateConstellationForDay).toHaveBeenCalledWith('u1', 42)
    expect(res.json).toHaveBeenCalledWith({ deleted: true, entryId: 'e9' })
  })

  it('skips the constellation recompute when the entry had no indexed day', async () => {
    ;(getEntryDayIndex as any).mockResolvedValueOnce(null)
    const res = mockRes()
    await deleteHandler({ uid: 'u1', params: { entryId: 'e9' } } as any, res)
    expect(deleteEntryChunks).toHaveBeenCalledWith('u1', 'e9')
    expect(updateConstellationForDay).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ deleted: true, entryId: 'e9' })
  })
})

describe('graphHandler', () => {
  it('returns the computed graph for the caller', async () => {
    const res = mockRes()
    await graphHandler({ uid: 'u1' } as any, res)
    expect(computeJournalGraph).toHaveBeenCalledWith('u1')
    expect(res.json).toHaveBeenCalledWith({ nodes: ['e1', 'e2'], edges: [{ a: 'e1', b: 'e2', score: 0.8 }] })
  })

  it('fails soft to an empty graph on error', async () => {
    ;(computeJournalGraph as any).mockRejectedValueOnce(new Error('boom'))
    const res = mockRes()
    await graphHandler({ uid: 'u1' } as any, res)
    expect(res.json).toHaveBeenCalledWith({ nodes: [], edges: [] })
  })
})

describe('searchHandler', () => {
  it('400s on missing queryText', async () => {
    const res = mockRes()
    await searchHandler({ uid: 'u1', body: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('clamps topK and returns hits', async () => {
    const res = mockRes()
    await searchHandler({ uid: 'u1', body: { queryText: 'hi', topK: 999 } } as any, res)
    expect(searchChunks).toHaveBeenCalledWith('u1', 'hi', 50)
    expect(res.json).toHaveBeenCalledWith({ hits: [{ entryId: 'e1', chunkIndex: 0, score: 0.9 }] })
  })

  it('defaults topK to 8', async () => {
    const res = mockRes()
    await searchHandler({ uid: 'u1', body: { queryText: 'hi' } } as any, res)
    expect(searchChunks).toHaveBeenCalledWith('u1', 'hi', 8)
  })
})
