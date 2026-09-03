import { describe, it, expect, vi, beforeEach } from 'vitest'

// `ai.ts` pulls in a wide service graph purely to be importable. Mirrors
// `dailyEncouragements.route.test.ts`: mock everything to the bare minimum needed
// for a clean import, plus the period-narrative job registry itself so this file
// tests only route validation, response shape, and middleware wiring.
const startPeriodNarrativeJob = vi.fn()
const getPeriodNarrativeJob = vi.fn()

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
  default: {
    firestore: { FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) } },
  },
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
vi.mock('../services/chain/soulService', () => ({
  ensureSoulMinted: vi.fn(),
  refreshSoulImage: vi.fn(),
}))
vi.mock('../services/constellation/constellationService', () => ({
  updateConstellationForDay: vi.fn(),
}))
vi.mock('../services/unsplashService', () => ({ searchPhoto: vi.fn() }))
vi.mock('../services/humeService', () => ({ scoreText: vi.fn() }))
vi.mock('../services/periodNarrative/jobs', () => ({
  startPeriodNarrativeJob: (...a: any[]) => startPeriodNarrativeJob(...a),
  getPeriodNarrativeJob: (...a: any[]) => getPeriodNarrativeJob(...a),
}))

import { aiRouter, periodNarrativeHandler, periodNarrativeJobHandler } from './ai'

function mockRes() {
  const res: any = {}
  res.statusCode = 200
  res.body = undefined
  res.status = (code: number) => { res.statusCode = code; return res }
  res.json = (payload: any) => { res.body = payload; return res }
  return res
}

const goodDays = [
  { dayIndex: 100, beats: [{ text: 'Shipped the beta', kind: 'event', domain: 'craft', isSpine: true }] },
]

beforeEach(() => { startPeriodNarrativeJob.mockReset(); getPeriodNarrativeJob.mockReset() })

describe('periodNarrativeHandler', () => {
  it('starts a job and returns 202 with a pending status', async () => {
    startPeriodNarrativeJob.mockReturnValue('job-1')
    const res = mockRes()
    await periodNarrativeHandler(
      { uid: 'u1', body: { periodType: 'week', periodIndex: 42, days: goodDays } } as any, res,
    )
    expect(res.statusCode).toBe(202)
    expect(res.body).toEqual({ jobId: 'job-1', status: 'pending' })
    expect(startPeriodNarrativeJob).toHaveBeenCalledWith('u1', 'week', 42, [
      { dayIndex: 100, beats: [{ text: 'Shipped the beta', kind: 'event', domain: 'craft', isSpine: true }] },
    ])
  })

  it('rejects an invalid periodType', async () => {
    const res = mockRes()
    await periodNarrativeHandler(
      { uid: 'u1', body: { periodType: 'decade', periodIndex: 1, days: goodDays } } as any, res,
    )
    expect(res.statusCode).toBe(400)
    expect(startPeriodNarrativeJob).not.toHaveBeenCalled()
  })

  it('rejects a missing periodIndex', async () => {
    const res = mockRes()
    await periodNarrativeHandler(
      { uid: 'u1', body: { periodType: 'week', days: goodDays } } as any, res,
    )
    expect(res.statusCode).toBe(400)
  })

  it('rejects a body with no days array', async () => {
    const res = mockRes()
    await periodNarrativeHandler(
      { uid: 'u1', body: { periodType: 'week', periodIndex: 1 } } as any, res,
    )
    expect(res.statusCode).toBe(400)
  })

  it('rejects a body whose days carry no beats at all', async () => {
    const res = mockRes()
    await periodNarrativeHandler(
      { uid: 'u1', body: { periodType: 'week', periodIndex: 1, days: [{ dayIndex: 1, beats: [] }] } } as any, res,
    )
    expect(res.statusCode).toBe(400)
    expect(startPeriodNarrativeJob).not.toHaveBeenCalled()
  })

  it('drops a beat with no text rather than failing the whole request', async () => {
    startPeriodNarrativeJob.mockReturnValue('job-1')
    const res = mockRes()
    await periodNarrativeHandler(
      {
        uid: 'u1',
        body: {
          periodType: 'week', periodIndex: 1,
          days: [{
            dayIndex: 1,
            beats: [{ text: '  ' }, { text: 'Real beat', kind: 'event', domain: 'craft', isSpine: false }],
          }],
        },
      } as any, res,
    )
    expect(res.statusCode).toBe(202)
    expect(startPeriodNarrativeJob).toHaveBeenCalledWith('u1', 'week', 1, [
      { dayIndex: 1, beats: [{ text: 'Real beat', kind: 'event', domain: 'craft', isSpine: false }] },
    ])
  })
})

describe('periodNarrativeJobHandler', () => {
  it('returns 404 for an unknown job', async () => {
    getPeriodNarrativeJob.mockReturnValue(undefined)
    const res = mockRes()
    await periodNarrativeJobHandler({ uid: 'u1', params: { jobId: 'x' } } as any, res)
    expect(res.statusCode).toBe(404)
  })

  it('returns pending while the job runs', async () => {
    getPeriodNarrativeJob.mockReturnValue({ status: 'pending' })
    const res = mockRes()
    await periodNarrativeJobHandler({ uid: 'u1', params: { jobId: 'x' } } as any, res)
    expect(res.body).toEqual({ status: 'pending' })
  })

  it('returns the narrative once done', async () => {
    getPeriodNarrativeJob.mockReturnValue({
      status: 'done',
      result: { narrative: 'You shipped the beta.', model: 'mock-model', generatedAt: '2026-09-03T00:00:00.000Z' },
    })
    const res = mockRes()
    await periodNarrativeJobHandler({ uid: 'u1', params: { jobId: 'x' } } as any, res)
    expect(res.body).toEqual({
      status: 'done', narrative: 'You shipped the beta.', model: 'mock-model', generatedAt: '2026-09-03T00:00:00.000Z',
    })
  })

  it('returns 200 with an error message on a failed job', async () => {
    getPeriodNarrativeJob.mockReturnValue({ status: 'failed', error: 'every model refused' })
    const res = mockRes()
    await periodNarrativeJobHandler({ uid: 'u1', params: { jobId: 'x' } } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'failed', error: 'every model refused' })
  })
})

interface RouteLayer {
  route?: { path: string; stack: Array<{ name: string }> }
}

describe('POST /period-narrative wiring', () => {
  it('is guarded by firebaseAuth, requirePro and requireAiConsent, in that order', () => {
    const layer = (aiRouter as unknown as { stack: RouteLayer[] }).stack
      .find(l => l.route?.path === '/period-narrative')
    expect(layer?.route, 'no route registered for /period-narrative').toBeTruthy()

    const names = layer!.route!.stack.map(h => h.name)
    const authIdx = names.indexOf('firebaseAuth')
    const proIdx = names.indexOf('requirePro')
    const consentIdx = names.indexOf('requireAiConsent')

    expect(authIdx, `stack was [${names.join(', ')}]`).toBeGreaterThanOrEqual(0)
    expect(proIdx).toBeGreaterThan(authIdx)
    expect(consentIdx).toBeGreaterThan(authIdx)
  })
})

describe('GET /period-narrative/:jobId wiring', () => {
  it('is guarded by firebaseAuth, requirePro and requireAiConsent, in that order', () => {
    const layer = (aiRouter as unknown as { stack: RouteLayer[] }).stack
      .find(l => l.route?.path === '/period-narrative/:jobId')
    expect(layer?.route, 'no route registered for /period-narrative/:jobId').toBeTruthy()

    const names = layer!.route!.stack.map(h => h.name)
    const authIdx = names.indexOf('firebaseAuth')
    const proIdx = names.indexOf('requirePro')
    const consentIdx = names.indexOf('requireAiConsent')

    expect(authIdx).toBeGreaterThanOrEqual(0)
    expect(proIdx).toBeGreaterThan(authIdx)
    expect(consentIdx).toBeGreaterThan(authIdx)
  })
})
