import { vi, describe, it, expect, beforeEach } from 'vitest'

// Hoisted so the vi.mock factory (hoisted above imports) can read it, while
// tests flip it to exercise the Model-1 (zero-knowledge) branch.
const model1 = vi.hoisted(() => ({ on: false }))
vi.mock('../config', () => ({ aiModel1Enabled: () => model1.on }))

const today: any[] = []
vi.mock('../middleware/firebaseAuth', () => {
  const reportDoc = { get: async () => ({ exists: false, data: () => undefined }), set: async () => {} }
  // Days subcollection supports both the latest-of-day query chain and per-id writes.
  const daysCol: any = {
    doc: () => reportDoc,
    orderBy: () => daysCol,
    startAt: () => daysCol,
    endAt: () => daysCol,
    limit: () => daysCol,
    get: async () => ({ empty: true, docs: [] }),
  }
  return {
    firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
    db: {
      collection: (name: string) => ({
        where: () => ({ where: () => ({ where: () => ({ get: async () => ({ docs: today }) }) }) }),
        doc: () => ({
          get: async () => ({ exists: name === 'users', data: () => ({ timezone: 'UTC', displayName: 'Sam', stats: { totalWords: 1000, streakCount: 3 } }) }),
          collection: () => daysCol,
        }),
      }),
    },
  }
})
vi.mock('../crypto/keyService', () => ({ getOrCreateDEK: vi.fn(async () => Buffer.alloc(32)) }))
vi.mock('../crypto/fieldCipher', () => ({
  openField: (_k: any, v: any) => (typeof v === 'string' ? v : ''),
  openFieldSafe: (_k: any, v: any) => (typeof v === 'string' ? v : ''),
  encryptField: (_k: any, v: string) => ({ ct: v }),
}))
vi.mock('../services/journalRetriever', () => ({ retrieveContext: vi.fn(async () => 'Past: worked too hard.') }))
vi.mock('../services/unsplashService', () => ({ searchPhoto: vi.fn(async () => ({ imageUrl: 'R', imageThumbUrl: 'T', photographerName: 'Jane', photographerUrl: 'U' })) }))
vi.mock('../services/humeService', () => ({
  scoreText: vi.fn(async () => ({
    scores: { Calmness: 0.8, Joy: 0.4 },
    top: [{ name: 'Calmness', score: 0.8 }, { name: 'Joy', score: 0.4 }],
  })),
}))
vi.mock('../services/aiClient', () => ({
  chatCompletion: vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ insights: 'i', findings: 'f', gem: 'q?', emotionSummary: 'e', imageQuery: 'calm sea' }) } }] }) })),
  DEFAULT_CHAT_MODEL: 'm',
}))
vi.mock('../services/prompts', () => ({ PROMPTS: { dailyReport: () => 'PROMPT' } }))

import { dailyReportHandler, dayBounds } from './dailyReport'
import { getOrCreateDEK } from '../crypto/keyService'
import { retrieveContext } from '../services/journalRetriever'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}
function entry(over: any = {}) {
  return { id: 'e1', data: () => ({ userId: 'u', type: 'text', createdAt: { toDate: () => new Date() }, content: 'Rested today.', title: 'T', excludeFromShare: false, emotion: { scores: { Calmness: 0.8, Joy: 0.4 } }, ...over }) }
}

beforeEach(() => { today.length = 0; model1.on = false; vi.clearAllMocks() })

describe('dailyReportHandler', () => {
  it('409s when there are no eligible entries today', async () => {
    const res = mockRes()
    await dailyReportHandler({ uid: 'u', body: {} } as any, res)
    expect(res.statusCode).toBe(409)
  })

  it('builds a report from today entries, excluding opted-out ones', async () => {
    today.push(entry(), entry({ excludeFromShare: true }))
    const res = mockRes()
    await dailyReportHandler({ uid: 'u', body: {} } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.insights).toBe('i')
    expect(res.body.question).toBe('q?')
    expect(res.body.totalWords).toBe(1000)
    expect(res.body.streakCount).toBe(3)
    expect(res.body.emotions[0].name).toBe('Calmness')
    expect(res.body.imageUrl).toBe('R')
    expect(res.body.photographerName).toBe('Jane')
    expect(res.body.sourceEntryIds).toEqual(['e1'])
  })

  it('legacy path (flag off) decrypts via getOrCreateDEK', async () => {
    today.push(entry())
    const res = mockRes()
    await dailyReportHandler({ uid: 'u', body: {} } as any, res)
    expect(res.statusCode).toBe(200)
    // Byte-identical legacy behavior: the server still decrypts server-side.
    expect(getOrCreateDEK).toHaveBeenCalledWith('u')
  })

  // ── Model 1 (zero-knowledge) ────────────────────────────────────────────────
  it('Model 1: uses client plaintext and does NOT call getOrCreateDEK', async () => {
    model1.on = true
    const res = mockRes()
    await dailyReportHandler(
      {
        uid: 'u',
        body: {
          todayText: 'Rested today and felt calm.',
          relatedContext: 'Past: worked too hard.',
          sourceEntryIds: ['e1', 'e2'],
        },
      } as any,
      res,
    )
    expect(res.statusCode).toBe(200)
    // The core invariant: no server-side decrypt on the Model-1 path.
    expect(getOrCreateDEK).not.toHaveBeenCalled()
    // Client-supplied RAG context is used verbatim (no server retrieveContext).
    expect(retrieveContext).not.toHaveBeenCalled()
    // Response shape unchanged, and client plaintext flows through.
    expect(res.body.insights).toBe('i')
    expect(res.body.question).toBe('q?')
    expect(res.body.wordsToday).toBe(5)
    expect(res.body.sourceEntryIds).toEqual(['e1', 'e2'])
    expect(res.body.id).toMatch(/_\d+$/)
  })

  it('Model 1: 409s when todayText is empty', async () => {
    model1.on = true
    const res = mockRes()
    await dailyReportHandler({ uid: 'u', body: { todayText: '   ' } } as any, res)
    expect(res.statusCode).toBe(409)
    expect(getOrCreateDEK).not.toHaveBeenCalled()
  })
})

describe('dayBounds', () => {
  it('returns local-midnight-in-UTC for a non-UTC timezone (EDT, UTC-4)', () => {
    const { start, end } = dayBounds(new Date('2026-06-22T15:00:00Z'), 'America/New_York')
    expect(start.toISOString()).toBe('2026-06-22T04:00:00.000Z')
    expect(end.toISOString()).toBe('2026-06-23T04:00:00.000Z')
  })
  it('returns UTC day boundaries for UTC', () => {
    const { start } = dayBounds(new Date('2026-06-22T15:00:00Z'), 'UTC')
    expect(start.toISOString()).toBe('2026-06-22T00:00:00.000Z')
  })
})
