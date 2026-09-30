import { describe, it, expect, vi, beforeEach } from 'vitest'

// Same minimal-mock approach as `dailyMirror.route.test.ts`: `ai.ts` pulls in a
// wide service graph purely to be importable, none of which matters here.
const chatCompletion = vi.fn()

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
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
  chatCompletion: (...args: any[]) => chatCompletion(...args),
  transcribeAudio: vi.fn(),
  streamToBuffer: vi.fn(),
  activeChatModel: () => 'mock-model',
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

import { aiRouter, periodSummaryHandler } from './ai'

function mockRes() {
  const res: any = {}
  res.statusCode = 200
  res.body = undefined
  res.status = (code: number) => { res.statusCode = code; return res }
  res.json = (payload: any) => { res.body = payload; return res }
  return res
}

function modelReply(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }
}

const body = {
  periodType: 'week',
  periodLabel: 'Week of Mon 21 Sep 2026',
  isOpen: true,
  children: [{
    id: 'day_20717', label: 'Mon 21 Sep 2026', text: 'You shipped the period summaries spec.', salience: 8,
    anchors: [{ entryId: 'e9', quote: 'I pressed the button and just sat there.' }], threads: ['Argo launch'],
  }],
}

beforeEach(() => { chatCompletion.mockReset() })

describe('periodSummaryHandler', () => {
  it('returns the grounded summary and model from one call', async () => {
    chatCompletion.mockResolvedValueOnce(modelReply(JSON.stringify({
      title: 'Shipping week', sentence: 'You shipped.', summary: 'A week of shipping.', salience: 8,
      anchors: [{ entryId: 'e9', quote: 'just sat there' }, { entryId: 'e1', quote: 'invented' }],
      keyScenes: { high: 'e9', low: 'nope', turning: null }, threads: ['Argo launch'],
    })))
    const res = mockRes()
    await periodSummaryHandler({ uid: 'u1', body } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      title: 'Shipping week', sentence: 'You shipped.', summary: 'A week of shipping.', salience: 8,
      anchors: [{ entryId: 'e9', quote: 'just sat there' }],
      keyScenes: { high: 'e9', low: null, turning: null }, threads: ['Argo launch'],
      model: 'mock-model',
    })
    expect(chatCompletion).toHaveBeenCalledTimes(1)
    const system = chatCompletion.mock.calls[0][0][0].content as string
    expect(system).toContain('Week of Mon 21 Sep 2026')
    expect(system).toContain('SO FAR')
    expect(system).toContain('You shipped the period summaries spec.')
    expect(system).toContain('Quote (entry e9): "I pressed the button and just sat there."')
  })

  it('retries once when the first reply does not parse', async () => {
    chatCompletion
      .mockResolvedValueOnce(modelReply('Sorry, here is prose.'))
      .mockResolvedValueOnce(modelReply('{"title":"T","sentence":"S.","summary":"B.","salience":5}'))
    const res = mockRes()
    await periodSummaryHandler({ uid: 'u1', body } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.sentence).toBe('S.')
    expect(chatCompletion).toHaveBeenCalledTimes(2)
  })

  it('returns 502 with no fallback text after two unparseable replies', async () => {
    chatCompletion.mockResolvedValue(modelReply('nope'))
    const res = mockRes()
    await periodSummaryHandler({ uid: 'u1', body } as any, res)
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: 'Period summary generation failed' })
  })

  it('returns 502 when the provider errors', async () => {
    chatCompletion.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const res = mockRes()
    await periodSummaryHandler({ uid: 'u1', body } as any, res)
    expect(res.statusCode).toBe(502)
  })

  it('returns 400 for an invalid body without calling the model', async () => {
    const res = mockRes()
    await periodSummaryHandler({ uid: 'u1', body: { ...body, periodType: 'decade' } } as any, res)
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid periodType' })
    expect(chatCompletion).not.toHaveBeenCalled()
  })
})

describe('/period-summary route wiring', () => {
  interface RouteLayer { route?: { path: string; stack: Array<{ name: string }> } }

  it('is behind firebaseAuth, requirePro, and requireAiConsent', () => {
    const layer = (aiRouter as unknown as { stack: RouteLayer[] }).stack
      .find(l => l.route?.path === '/period-summary')
    expect(layer?.route, 'no route registered for /period-summary').toBeTruthy()

    const names = layer!.route!.stack.map(h => h.name)
    const authIdx = names.indexOf('firebaseAuth')
    expect(authIdx, `stack was [${names.join(', ')}]`).toBeGreaterThanOrEqual(0)
    expect(names.indexOf('requirePro')).toBeGreaterThan(authIdx)
    expect(names.indexOf('requireAiConsent')).toBeGreaterThan(authIdx)
  })
})
