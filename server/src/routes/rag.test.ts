import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ userId: 'u' }) }) }) }) },
}))
vi.mock('../crypto/keyService', () => ({ getOrCreateDEK: vi.fn(async () => Buffer.alloc(32)) }))
vi.mock('../services/summaryIndexer', () => ({
  findRelated: vi.fn(async () => [
    { journalId: 'e2', title: 'B', type: 'voice', date: '2026-02-01', snippet: 's', score: 0.8 },
  ]),
  indexSummary: vi.fn(), deleteSummary: vi.fn(),
}))
vi.mock('../services/journalIndexer', () => ({ indexJournalEntry: vi.fn(), deleteJournalEntry: vi.fn() }))
vi.mock('../services/summaryGenerator', () => ({ generateSummaryText: vi.fn() }))
vi.mock('../crypto/fieldCipher', () => ({ openField: vi.fn(), encryptField: vi.fn() }))
vi.mock('../config', () => ({ config: { RELATED_TOP_K: 20 } }))

import { relatedHandler } from './rag'
import { findRelated } from '../services/summaryIndexer'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

describe('relatedHandler', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns related entries for the owner', async () => {
    const req: any = { uid: 'u', body: { journalId: 'e1' } }
    const res = mockRes()
    await relatedHandler(req, res)
    expect(res.body.related[0].journalId).toBe('e2')
    expect(findRelated).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u', entryId: 'e1', limit: 20 }))
  })

  it('400 without journalId', async () => {
    const req: any = { uid: 'u', body: {} }
    const res = mockRes()
    await relatedHandler(req, res)
    expect(res.statusCode).toBe(400)
  })
})
