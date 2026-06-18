import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../config', () => ({ config: { RAG_TOP_K: 20, TOGETHER_EMBEDDING_MODEL: 'x' } }))
const queryMock = vi.fn()
vi.mock('../db/chroma', () => ({
  getJournalsCollection: () => Promise.resolve({ query: queryMock }),
  resetJournalsCollection: vi.fn(),
}))
vi.mock('./aiClient', () => ({ embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]) }))
vi.mock('../crypto/fieldCipher', () => ({
  decryptField: (_k: Buffer, v: any, _c: string) => (v.__plain ?? 'DEC'),
}))

import { retrieveContextWithSources } from './journalRetriever'

describe('retrieveContextWithSources', () => {
  beforeEach(() => queryMock.mockReset())

  it('returns structured sources with score, decrypted title and snippet', async () => {
    queryMock.mockResolvedValue({
      documents: [[JSON.stringify({ __plain: 'chunk text' })]],
      metadatas: [[{ entryId: 'e1', type: 'note', title: JSON.stringify({ __plain: 'My Title' }), chunkIndex: 0, indexedAt: '2026-06-01T00:00:00Z' }]],
      distances: [[0.25]],
    })
    const out = await retrieveContextWithSources('u1', 'hello', Buffer.alloc(32))
    expect(out.sources).toHaveLength(1)
    expect(out.sources[0]).toMatchObject({ journalId: 'e1', type: 'note', date: '2026-06-01', title: 'My Title', snippet: 'chunk text' })
    expect(out.sources[0].score).toBeCloseTo(0.75) // 1 - distance
    expect(out.contextString).toContain('chunk text')
  })

  it('returns empty on no docs', async () => {
    queryMock.mockResolvedValue({ documents: [[]], metadatas: [[]], distances: [[]] })
    const out = await retrieveContextWithSources('u1', 'hi', Buffer.alloc(32))
    expect(out.sources).toEqual([])
    expect(out.contextString).toBe('')
  })
})
