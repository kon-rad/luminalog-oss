import { vi, describe, it, expect, beforeEach } from 'vitest'

const col = {
  get: vi.fn(),
  delete: vi.fn(),
  add: vi.fn(),
  query: vi.fn(),
}
vi.mock('../db/chroma', () => ({
  getSummariesCollection: vi.fn(async () => col),
  resetSummariesCollection: vi.fn(),
}))
vi.mock('./aiClient', () => ({ embed: vi.fn(async () => [[0.1, 0.2]]), embedQuery: vi.fn() }))
vi.mock('../crypto/fieldCipher', () => ({
  encryptField: (_k: Buffer, t: string) => ({ ct: t }),
  decryptField: (_k: Buffer, f: any) => f.ct,
}))
vi.mock('../config', () => ({ config: { RELATED_TOP_K: 20 } }))

import { indexSummary, deleteSummary, findRelated } from './summaryIndexer'

const dek = Buffer.alloc(32)

describe('summaryIndexer', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('indexSummary purges existing id then adds one vector', async () => {
    col.get.mockResolvedValue({ ids: ['u_e1'] })
    await indexSummary({
      userId: 'u', entryId: 'e1', summaryText: 'hi', type: 'text',
      title: 'T', date: '2026-06-17', dek,
    })
    expect(col.delete).toHaveBeenCalledWith({ ids: ['u_e1'] })
    const addArg = col.add.mock.calls[0][0]
    expect(addArg.ids).toEqual(['u_e1'])
    expect(addArg.embeddings).toEqual([[0.1, 0.2]])
    expect(addArg.metadatas[0].userId).toBe('u')
    expect(addArg.metadatas[0].entryId).toBe('e1')
  })

  it('findRelated excludes self and decrypts titles/snippets', async () => {
    col.get.mockResolvedValue({ ids: ['u_e1'], embeddings: [[0.1, 0.2]] })
    col.query.mockResolvedValue({
      ids: [['u_e1', 'u_e2', 'u_e3']],
      documents: [[null, JSON.stringify({ ct: 'snippet 2' }), JSON.stringify({ ct: 'snippet 3' })]],
      metadatas: [[
        { entryId: 'e1', type: 'text', title: JSON.stringify({ ct: 'A' }), date: '2026-01-01' },
        { entryId: 'e2', type: 'voice', title: JSON.stringify({ ct: 'B' }), date: '2026-02-01' },
        { entryId: 'e3', type: 'text', title: JSON.stringify({ ct: 'C' }), date: '2026-03-01' },
      ]],
      distances: [[0, 0.2, 0.4]],
    })
    const out = await findRelated({ userId: 'u', entryId: 'e1', limit: 20, dek })
    expect(out.map(r => r.journalId)).toEqual(['e2', 'e3'])
    expect(out[0]).toMatchObject({ title: 'B', type: 'voice', snippet: 'snippet 2' })
  })

  it('findRelated returns [] when the entry has no stored vector', async () => {
    col.get.mockResolvedValue({ ids: [], embeddings: [] })
    const out = await findRelated({ userId: 'u', entryId: 'e1', limit: 20, dek })
    expect(out).toEqual([])
  })

  it('deleteSummary removes the entry id', async () => {
    col.get.mockResolvedValue({ ids: ['u_e1'] })
    await deleteSummary('u', 'e1')
    expect(col.delete).toHaveBeenCalledWith({ ids: ['u_e1'] })
  })
})
