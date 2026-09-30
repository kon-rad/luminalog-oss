import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../services/ragStore', () => ({
  indexEntryChunks: vi.fn(async () => 2),
  deleteEntryChunks: vi.fn(async () => {}),
  searchChunks: vi.fn(async () => [{ entryId: 'e1', chunkIndex: 0, score: 0.9 }]),
  getEntryDays: vi.fn(async () => ({ dayIndex: 42, localDayIndex: 43 })),
}))
vi.mock('../services/periodCentroid/rollup', () => ({
  updatePeriodCentroidsForDay: vi.fn(async () => {}),
}))
vi.mock('../services/periodCentroid/localDay', () => ({
  resolveEntryLocalDay: vi.fn(async () => 6),
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
vi.mock('../middleware/requirePro', () => ({ requirePro: vi.fn() }))

import { indexHandler, deleteHandler, searchHandler, graphHandler } from './rag'
import { indexEntryChunks, deleteEntryChunks, searchChunks, getEntryDays } from '../services/ragStore'
import { updatePeriodCentroidsForDay } from '../services/periodCentroid/rollup'
import { resolveEntryLocalDay } from '../services/periodCentroid/localDay'
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
      userId: 'u1', entryId: 'e1', type: 'text', dayIndex: 5, localDayIndex: expect.any(Promise), wordCount: 12, chunks: ['a', 'b'],
    })
    // The pending local day still resolves to the profile-timezone day for the chunk metadata.
    expect(await (indexEntryChunks as any).mock.calls[0][0].localDayIndex).toBe(6)
    expect(res.json).toHaveBeenCalledWith({ ok: true, entryId: 'e1', chunks: 2 })
  })

  it('starts the local-day lookup before embedding instead of awaiting it first', async () => {
    let resolveDay!: (d: number) => void
    ;(resolveEntryLocalDay as any).mockReturnValueOnce(new Promise<number>(r => { resolveDay = r }))
    let lookupSettledAtIndexStart: boolean | null = null
    let settled = false
    ;(indexEntryChunks as any).mockImplementationOnce(async (p: any) => {
      lookupSettledAtIndexStart = settled
      await p.localDayIndex
      return 1
    })
    const res = mockRes()
    const done = indexHandler({ uid: 'u1', body: { entryId: 'e1', dayIndex: 5, chunks: ['a'] } } as any, res)
    await new Promise(setImmediate)
    expect(resolveEntryLocalDay).toHaveBeenCalledWith('u1', 'e1', 5)
    expect(indexEntryChunks).toHaveBeenCalled()
    expect(lookupSettledAtIndexStart).toBe(false)
    settled = true
    resolveDay(6)
    await done
    await new Promise(setImmediate)
    expect(res.json).toHaveBeenCalledWith({ ok: true, entryId: 'e1', chunks: 1 })
    expect(updatePeriodCentroidsForDay).toHaveBeenCalledWith('u1', 6)
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

  it("refreshes period centroids for the entry's local day", async () => {
    const res = mockRes()
    await indexHandler({ uid: 'u1', body: { entryId: 'e1', dayIndex: 5, chunks: ['a'] } } as any, res)
    await new Promise(setImmediate)
    expect(resolveEntryLocalDay).toHaveBeenCalledWith('u1', 'e1', 5)
    expect(updatePeriodCentroidsForDay).toHaveBeenCalledWith('u1', 6)
    expect(updateConstellationForDay).toHaveBeenCalledWith('u1', 5) // constellation stays on dayIndex
  })

  it('still succeeds when the period centroid refresh throws (non-fatal)', async () => {
    ;(updatePeriodCentroidsForDay as any).mockRejectedValueOnce(new Error('boom'))
    const res = mockRes()
    await indexHandler({ uid: 'u1', body: { entryId: 'e1', dayIndex: 5, chunks: ['a'] } } as any, res)
    await new Promise(setImmediate)
    expect(updatePeriodCentroidsForDay).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ ok: true, entryId: 'e1', chunks: 2 })
  })
})

describe('deleteHandler', () => {
  it("reads the entry's days in one metadata read before purging and refreshes the local day", async () => {
    const res = mockRes()
    await deleteHandler({ uid: 'u1', params: { entryId: 'e9' } } as any, res)
    await new Promise(setImmediate)
    expect(getEntryDays).toHaveBeenCalledTimes(1)
    expect(getEntryDays).toHaveBeenCalledWith('u1', 'e9')
    expect((getEntryDays as any).mock.invocationCallOrder[0])
      .toBeLessThan((deleteEntryChunks as any).mock.invocationCallOrder[0])
    expect(updatePeriodCentroidsForDay).toHaveBeenCalledWith('u1', 43)
  })

  it('skips the position refresh for chunks that predate localDayIndex', async () => {
    ;(getEntryDays as any).mockResolvedValueOnce({ dayIndex: 42, localDayIndex: null })
    const res = mockRes()
    await deleteHandler({ uid: 'u1', params: { entryId: 'e9' } } as any, res)
    expect(updatePeriodCentroidsForDay).not.toHaveBeenCalled()
    expect(updateConstellationForDay).toHaveBeenCalledWith('u1', 42)
    expect(res.json).toHaveBeenCalledWith({ deleted: true, entryId: 'e9' })
  })

  it('deletes the entry’s chunks for the caller and recomputes its day', async () => {
    const res = mockRes()
    await deleteHandler({ uid: 'u1', params: { entryId: 'e9' } } as any, res)
    expect(deleteEntryChunks).toHaveBeenCalledWith('u1', 'e9')
    expect(updateConstellationForDay).toHaveBeenCalledWith('u1', 42)
    expect(res.json).toHaveBeenCalledWith({ deleted: true, entryId: 'e9' })
  })

  it('skips the constellation recompute when the entry had no indexed day', async () => {
    ;(getEntryDays as any).mockResolvedValueOnce({ dayIndex: null, localDayIndex: null })
    const res = mockRes()
    await deleteHandler({ uid: 'u1', params: { entryId: 'e9' } } as any, res)
    expect(deleteEntryChunks).toHaveBeenCalledWith('u1', 'e9')
    expect(updateConstellationForDay).not.toHaveBeenCalled()
    expect(updatePeriodCentroidsForDay).not.toHaveBeenCalled()
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
