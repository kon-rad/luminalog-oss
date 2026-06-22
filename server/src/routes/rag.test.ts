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
vi.mock('../config', () => ({ config: { RELATED_TOP_K: 20, GRAPH_TOP_K: 4, GRAPH_MIN_SIMILARITY: 0.75, GRAPH_MAX_DEGREE: 12, AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'x', AWS_SECRET_ACCESS_KEY: 'x', AWS_S3_BUCKET: 'b' } }))
vi.mock('../services/entryEmotion', () => ({ scoreEntryEmotion: vi.fn() }))
vi.mock('../crypto/mediaCipher', () => ({ decryptMedia: vi.fn() }))
vi.mock('../services/audioExtractor', () => ({ extractAudio: vi.fn() }))
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: vi.fn(() => ({ send: vi.fn() })), GetObjectCommand: vi.fn() }))
vi.mock('../services/aiClient', () => ({ embedQuery: vi.fn(), streamToBuffer: vi.fn() }))
vi.mock('../services/s3', () => ({ deleteMediaObjects: vi.fn(async () => {}) }))
vi.mock('../services/graphBuilder', () => ({
  getGraph: vi.fn(async () => ({
    nodes: [{ id: 'e1', title: 'T1', date: '2026-06-01', type: 'text', degree: 1 }],
    links: [{ source: 'e1', target: 'e2', value: 0.91 }],
  })),
  invalidateGraph: vi.fn(),
}))

import { relatedHandler, deleteHandler, graphHandler } from './rag'
import { findRelated, deleteSummary } from '../services/summaryIndexer'
import { deleteJournalEntry } from '../services/journalIndexer'
import { deleteMediaObjects } from '../services/s3'
import { getGraph } from '../services/graphBuilder'

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

describe('deleteHandler', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('400 without journalId', async () => {
    const req: any = { uid: 'u', query: {} }
    const res = mockRes()
    await deleteHandler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('purges embeddings + summary and returns deleted:true', async () => {
    const req: any = { uid: 'u', query: { journalId: 'e1' } }
    const res = mockRes()
    await deleteHandler(req, res)
    expect(deleteJournalEntry).toHaveBeenCalledWith('u', 'e1')
    expect(deleteSummary).toHaveBeenCalledWith('u', 'e1')
    expect(res.body).toEqual({ deleted: true })
  })

  it('still purges embeddings when S3 delete throws (best-effort)', async () => {
    ;(deleteMediaObjects as any).mockRejectedValueOnce(new Error('s3 down'))
    const req: any = { uid: 'u', query: { journalId: 'e1' } }
    const res = mockRes()
    await deleteHandler(req, res)
    expect(deleteJournalEntry).toHaveBeenCalledWith('u', 'e1')
    expect(res.body).toEqual({ deleted: true })
  })
})

describe('graphHandler', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the graph for the authed user', async () => {
    const req: any = { uid: 'u' }
    const res = mockRes()
    await graphHandler(req, res)
    expect(getGraph).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u' }))
    expect(res.body).toEqual(expect.objectContaining({
      nodes: expect.any(Array),
      links: expect.any(Array),
    }))
  })

  it('500s when the build throws', async () => {
    ;(getGraph as any).mockRejectedValueOnce(new Error('chroma down'))
    const req: any = { uid: 'u' }
    const res = mockRes()
    await graphHandler(req, res)
    expect(res.statusCode).toBe(500)
  })
})
