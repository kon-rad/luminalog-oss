import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../services/ragStore', () => ({
  indexEntryChunks: vi.fn(async () => 2),
  deleteEntryChunks: vi.fn(async () => {}),
  searchChunks: vi.fn(async () => [{ entryId: 'e1', chunkIndex: 0, score: 0.9 }]),
}))
// The route module imports auth/consent middleware at load time; stub them so the
// handlers can be exercised directly without Firebase.
vi.mock('../middleware/firebaseAuth', () => ({ firebaseAuth: vi.fn(), db: {} }))
vi.mock('../middleware/requireAiConsent', () => ({ requireAiConsent: vi.fn() }))

import { indexHandler, deleteHandler, searchHandler } from './rag'
import { indexEntryChunks, deleteEntryChunks, searchChunks } from '../services/ragStore'

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
})

describe('deleteHandler', () => {
  it('deletes the entry’s chunks for the caller', async () => {
    const res = mockRes()
    await deleteHandler({ uid: 'u1', params: { entryId: 'e9' } } as any, res)
    expect(deleteEntryChunks).toHaveBeenCalledWith('u1', 'e9')
    expect(res.json).toHaveBeenCalledWith({ deleted: true, entryId: 'e9' })
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
