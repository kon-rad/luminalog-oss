import { vi, describe, it, expect, beforeEach } from 'vitest'

// Dual-mode (Model 1 / zero-knowledge) tests for POST /v1/ai/summary. Flag ON +
// client plaintext → the plaintext is forwarded to Together AI and the server
// NEVER decrypts (getOrCreateDEK is not called). Flag OFF → byte-identical legacy
// path that fetches + decrypts the entry via getOrCreateDEK.

// Hoisted so the vi.mock('../config') factory can read it while tests toggle it.
const model1 = vi.hoisted(() => ({ on: false }))
vi.mock('../config', () => ({
  config: { AWS_REGION: 'r', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 's', AWS_S3_BUCKET: 'b' },
  chainEnabled: () => false,
  aiModel1Enabled: () => model1.on,
}))

// Firestore: the journal doc (legacy path decrypts this) + user doc (summaryConfig).
const journalData = { userId: 'u', type: 'text', content: { v: 1 }, title: { v: 1 } }
const journalGet = vi.fn(async () => ({ exists: true, data: () => journalData }))
vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db: {
    collection: (name: string) => ({
      doc: () => ({
        get: name === 'users'
          ? async () => ({ exists: true, data: () => ({ summaryConfig: { wordLength: 40 } }) })
          : journalGet,
      }),
    }),
  },
}))
vi.mock('../crypto/keyService', () => ({ getOrCreateDEK: vi.fn(async () => Buffer.alloc(32)) }))
// openField returns a recognizable server-decrypted marker so we can distinguish
// which text reached the LLM (legacy decrypt vs client plaintext).
vi.mock('../crypto/fieldCipher', () => ({
  openField: vi.fn(() => 'SERVER_DECRYPTED_CONTENT'),
  encryptField: vi.fn(() => ({ ct: '' })),
}))
vi.mock('../crypto/mediaCipher', () => ({ decryptMedia: vi.fn() }))

// Capture the content that generateSummaryText receives (hoisted so the vi.mock
// factory below — itself hoisted above imports — can reference it).
const genSpy = vi.hoisted(() =>
  vi.fn(async (p: any) => ({ text: `SUMMARY_OF:${p.content}`, model: 'M', generatedAt: 'T' })),
)
vi.mock('../services/summaryGenerator', () => ({ generateSummaryText: genSpy }))

// Everything else ai.ts imports at module load (unused by summaryHandler).
vi.mock('../services/aiClient', () => ({ chatCompletion: vi.fn(), transcribeAudio: vi.fn(), streamToBuffer: vi.fn() }))
vi.mock('../services/journalIndexer', () => ({ indexJournalEntry: vi.fn() }))
vi.mock('../services/audioExtractor', () => ({ extractAudio: vi.fn() }))
vi.mock('../services/prompts', () => ({ PROMPTS: { dailyPrompts: () => 'P' } }))
vi.mock('../services/summaryService', () => ({ ensureEntryAIIndexed: vi.fn() }))
vi.mock('../services/graphBuilder', () => ({ invalidateGraph: vi.fn() }))
vi.mock('../services/dailyGoalStreak', () => ({ nextStats: vi.fn(), dayIndex: vi.fn(), WORD_TARGET: 750 }))
vi.mock('../services/constellation/constellationService', () => ({ updateConstellationForDay: vi.fn() }))
vi.mock('../services/chain/soulService', () => ({ ensureSoulMinted: vi.fn(), refreshSoulImage: vi.fn() }))
vi.mock('../services/profileContext', () => ({ decodeProfileFields: vi.fn(() => ({})) }))
vi.mock('../services/dailyPrompts', () => ({ DAILY_PROMPT_AREAS: [], parseDailyPrompts: vi.fn(), fallbackDailyPrompts: vi.fn() }))
vi.mock('./dailyReport', () => ({ dailyReportHandler: vi.fn() }))
vi.mock('./transcribeClip', () => ({ transcribeClipHandler: vi.fn() }))
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: class { send = vi.fn() }, GetObjectCommand: class {} }))

import { summaryHandler } from './ai'
import { getOrCreateDEK } from '../crypto/keyService'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

beforeEach(() => { model1.on = false; vi.clearAllMocks() })

describe('summaryHandler dual-mode', () => {
  it('legacy path (flag off): decrypts the entry via getOrCreateDEK', async () => {
    const res = mockRes()
    await summaryHandler({ uid: 'u', body: { journalId: 'e1' } } as any, res)
    expect(res.statusCode).toBe(200)
    expect(getOrCreateDEK).toHaveBeenCalledWith('u')
    // Server-decrypted content flowed to the LLM.
    expect(genSpy.mock.calls[0][0].content).toBe('SERVER_DECRYPTED_CONTENT')
    expect(res.body).toEqual({ text: 'SUMMARY_OF:SERVER_DECRYPTED_CONTENT', model: 'M', generatedAt: 'T' })
  })

  it('legacy path: 400 when journalId is missing', async () => {
    const res = mockRes()
    await summaryHandler({ uid: 'u', body: {} } as any, res)
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Missing journalId' })
  })

  it('Model 1 (flag on): forwards client plaintext and does NOT call getOrCreateDEK', async () => {
    model1.on = true
    const res = mockRes()
    await summaryHandler({ uid: 'u', body: { content: 'my private entry', type: 'text' } } as any, res)
    expect(res.statusCode).toBe(200)
    // The core invariant: no server-side decrypt on the Model-1 path.
    expect(getOrCreateDEK).not.toHaveBeenCalled()
    // Client plaintext — not the decrypt marker — reached the LLM.
    expect(genSpy.mock.calls[0][0].content).toBe('my private entry')
    // Response shape unchanged.
    expect(res.body).toEqual({ text: 'SUMMARY_OF:my private entry', model: 'M', generatedAt: 'T' })
  })

  it('Model 1 off in effect when no plaintext supplied → legacy decrypt runs', async () => {
    model1.on = true
    const res = mockRes()
    // No `content` in the body → falls back to the legacy server-decrypt path.
    await summaryHandler({ uid: 'u', body: { journalId: 'e1' } } as any, res)
    expect(getOrCreateDEK).toHaveBeenCalledWith('u')
    expect(genSpy.mock.calls[0][0].content).toBe('SERVER_DECRYPTED_CONTENT')
  })
})
