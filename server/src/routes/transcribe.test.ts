import { vi, describe, it, expect, beforeEach } from 'vitest'

// Regression test for the constellation/Related bug: voice & video entries reach
// the server only via /transcribe, which historically indexed content chunks but
// never a summary vector — leaving the constellation graph and Related tab empty.

const journalGet = vi.fn(async () => ({
  exists: true,
  data: () => ({ userId: 'u', media: [{ kind: 'audio', s3Key: 'k' }], content: 'c', title: 't', type: 'voice' }),
}))
const journalUpdate = vi.fn(async () => {})

vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: { serverTimestamp: () => 'ts' },
      Timestamp: { fromDate: (d: Date) => d },
    },
  },
}))
vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db: {
    collection: () => ({ doc: () => ({ get: journalGet, update: journalUpdate }) }),
    runTransaction: async (fn: any) => fn({ get: async () => ({ data: () => ({}) }), update: () => {}, set: () => {} }),
  },
}))
vi.mock('../crypto/keyService', () => ({ getOrCreateDEK: vi.fn(async () => Buffer.alloc(32)) }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = vi.fn(async () => ({ Body: {} })) },
  GetObjectCommand: class {},
}))
vi.mock('../services/aiClient', () => ({
  transcribeAudio: vi.fn(async () => 'hello world transcript'),
  streamToBuffer: vi.fn(async () => Buffer.from('audio')),
  chatCompletion: vi.fn(),
}))
vi.mock('../crypto/mediaCipher', () => ({ decryptMedia: vi.fn(() => Buffer.from('audio')) }))
vi.mock('../crypto/fieldCipher', () => ({ openField: vi.fn(() => ''), encryptField: vi.fn(() => ({ ct: '' })) }))
vi.mock('../services/audioExtractor', () => ({ extractAudio: vi.fn(async () => Buffer.from('a')) }))
vi.mock('../services/journalIndexer', () => ({ indexJournalEntry: vi.fn(async () => ({ chunks: 2 })) }))
vi.mock('../services/dailyGoalStreak', () => ({
  nextStats: vi.fn(() => ({ streakCount: 1, totalWords: 1, goalDayWords: 1, lastEntryDate: null, goalDayDate: null })),
  dayIndex: vi.fn(() => 0),
  WORD_TARGET: 750,
}))
vi.mock('../services/summaryService', () => ({ ensureEntryAIIndexed: vi.fn(async () => true) }))
vi.mock('../services/constellation/constellationService', () => ({ updateConstellationForDay: vi.fn(async () => {}) }))
vi.mock('../services/graphBuilder', () => ({ invalidateGraph: vi.fn() }))
vi.mock('../services/entryEmotion', () => ({ scoreEntryEmotion: vi.fn() }))
vi.mock('../config', () => ({
  config: { AWS_REGION: 'r', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 's', AWS_S3_BUCKET: 'b' },
  chainEnabled: () => false,
  aiModel1Enabled: () => false,
}))

import { transcribeHandler } from './ai'
import { ensureEntryAIIndexed } from '../services/summaryService'
import { invalidateGraph } from '../services/graphBuilder'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

describe('transcribeHandler', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('indexes a summary vector for the transcribed entry and invalidates the graph', async () => {
    const req: any = { uid: 'u', body: { journalId: 'e1' } }
    const res = mockRes()
    await transcribeHandler(req, res)

    expect(res.body).toEqual({ transcribed: true, chunks: 2 })
    // The core fix: the voice/video path must index a summary vector.
    expect(ensureEntryAIIndexed).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u', journalId: 'e1', force: true }),
    )
    // And it must include the freshly transcribed text in the AI content.
    expect((ensureEntryAIIndexed as any).mock.calls[0][0].content).toContain('hello world transcript')
    expect(invalidateGraph).toHaveBeenCalledWith('u')
  })

  it('keeps the transcript (200) even when summary indexing fails', async () => {
    ;(ensureEntryAIIndexed as any).mockRejectedValueOnce(new Error('together 503'))
    const req: any = { uid: 'u', body: { journalId: 'e1' } }
    const res = mockRes()
    await transcribeHandler(req, res)
    expect(res.body).toEqual({ transcribed: true, chunks: 2 })
    expect(res.statusCode).toBe(200)
  })
})
