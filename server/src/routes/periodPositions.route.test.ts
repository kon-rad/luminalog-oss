import { describe, it, expect, vi, beforeEach } from 'vitest'

// ai.ts pulls in a wide service graph purely to be importable. Mirrors
// periodNarrative.route.test.ts: mock everything to the bare minimum needed for a
// clean import, plus this task's own service, so this file tests only route
// validation and response shape.
const getPeriodPositions = vi.fn()

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u1'; next() },
  db: { collection: () => ({ doc: () => ({ async get() { return { exists: false } } }) }) },
}))
vi.mock('../config', () => ({
  config: {},
  enforceAiConsentEnabled: () => false,
  chainEnabled: () => false,
}))
vi.mock('firebase-admin', () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) } } },
}))
vi.mock('../services/aiClient', () => ({
  chatCompletion: vi.fn(),
  transcribeAudio: vi.fn(),
  streamToBuffer: vi.fn(),
  activeChatModel: () => 'mock-model',
  chatModelChain: () => ['mock-model'],
}))
vi.mock('../services/audioExtractor', () => ({ extractAudio: vi.fn() }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send() { return Promise.resolve() } },
  GetObjectCommand: class {},
  PutObjectCommand: class {},
}))
vi.mock('../services/chain/soulService', () => ({ ensureSoulMinted: vi.fn(), refreshSoulImage: vi.fn() }))
vi.mock('../services/constellation/constellationService', () => ({ updateConstellationForDay: vi.fn() }))
vi.mock('../services/unsplashService', () => ({ searchPhoto: vi.fn() }))
vi.mock('../services/humeService', () => ({ scoreText: vi.fn() }))
vi.mock('../services/periodNarrative/jobs', () => ({
  startPeriodNarrativeJob: vi.fn(), getPeriodNarrativeJob: vi.fn(),
}))
vi.mock('../services/periodCentroid/rollup', () => ({
  getPeriodPositions: (...a: any[]) => getPeriodPositions(...a),
}))

import { periodPositionsHandler } from './ai'

function mockRes() {
  const res: any = {}
  res.statusCode = 200
  res.body = undefined
  res.status = (code: number) => { res.statusCode = code; return res }
  res.json = (payload: any) => { res.body = payload; return res }
  return res
}

beforeEach(() => { getPeriodPositions.mockReset() })

describe('periodPositionsHandler', () => {
  it('returns points for a valid tier', async () => {
    getPeriodPositions.mockResolvedValue([
      { periodIndex: 1, x: 0.1, y: 0.2, z: 0.3, childCount: 2, parentIndex: 202601 },
    ])
    const res = mockRes()
    await periodPositionsHandler({ uid: 'u1', params: { periodType: 'week' } } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.points).toHaveLength(1)
    expect(getPeriodPositions).toHaveBeenCalledWith('u1', 'week')
  })

  it('rejects an invalid periodType', async () => {
    const res = mockRes()
    await periodPositionsHandler({ uid: 'u1', params: { periodType: 'decade' } } as any, res)
    expect(res.statusCode).toBe(400)
    expect(getPeriodPositions).not.toHaveBeenCalled()
  })

  it('returns 500 when the read fails', async () => {
    getPeriodPositions.mockRejectedValue(new Error('firestore down'))
    const res = mockRes()
    await periodPositionsHandler({ uid: 'u1', params: { periodType: 'week' } } as any, res)
    expect(res.statusCode).toBe(500)
  })
})
