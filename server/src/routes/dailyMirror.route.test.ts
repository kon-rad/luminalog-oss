import { describe, it, expect, vi, beforeEach } from 'vitest'

// Same minimal-mock approach as `dailyEncouragements.route.test.ts`: `ai.ts`
// pulls in a wide service graph purely to be importable, none of which
// matters here.
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

import { aiRouter, dailyMirrorHandler } from './ai'

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

const entries = [{ id: 'e1', type: 'text', title: 'Monday', content: 'I kept avoiding the hard call.' }]

beforeEach(() => { chatCompletion.mockReset() })

describe('dailyMirrorHandler', () => {
  it('returns all three echoes and the source entry ids from a single model call', async () => {
    chatCompletion.mockResolvedValueOnce(modelReply(JSON.stringify({
      morning: 'Name the thing you are avoiding before the day fills up.',
      afternoon: 'The friction today is just information.',
      evening: 'Let today be enough as it is.',
    })))

    const res = mockRes()
    await dailyMirrorHandler({ uid: 'u1', body: { name: 'Kon', profile: {}, entries } } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.morning).toBe('Name the thing you are avoiding before the day fills up.')
    expect(res.body.afternoon).toBe('The friction today is just information.')
    expect(res.body.evening).toBe('Let today be enough as it is.')
    expect(res.body.sourceEntryIds).toEqual(['e1'])
    expect(chatCompletion).toHaveBeenCalledTimes(1)
  })

  it('grounds the single system prompt in the journal context', async () => {
    chatCompletion.mockResolvedValue(modelReply(JSON.stringify({
      morning: 'A.', afternoon: 'B.', evening: 'C.',
    })))

    await dailyMirrorHandler({ uid: 'u1', body: { profile: {}, entries } } as any, mockRes())

    expect(chatCompletion).toHaveBeenCalledTimes(1)
    const prompt = chatCompletion.mock.calls[0][0][0].content as string
    expect(prompt).toContain('I kept avoiding the hard call.')
  })

  it('strips a wrapping quote pair from an individual slot value', async () => {
    chatCompletion.mockResolvedValue(modelReply(JSON.stringify({
      morning: '"A quoted sentence."', afternoon: 'B.', evening: 'C.',
    })))

    const res = mockRes()
    await dailyMirrorHandler({ uid: 'u1', body: { profile: {}, entries } } as any, res)

    expect(res.body.morning).toBe('A quoted sentence.')
  })

  it('retries the whole call once on an unparseable reply, then falls back for every slot', async () => {
    chatCompletion
      .mockResolvedValueOnce(modelReply('not json'))
      .mockResolvedValueOnce(modelReply('still not json'))

    const res = mockRes()
    await dailyMirrorHandler({ uid: 'u1', body: { profile: {}, entries } } as any, res)

    expect(chatCompletion).toHaveBeenCalledTimes(2)
    expect(res.statusCode).toBe(200)
    expect(res.body.morning.length).toBeGreaterThan(0)
    expect(res.body.afternoon.length).toBeGreaterThan(0)
    expect(res.body.evening.length).toBeGreaterThan(0)
  })

  it('recovers on the retry when the first call is unparseable', async () => {
    chatCompletion
      .mockResolvedValueOnce(modelReply('not json'))
      .mockResolvedValueOnce(modelReply(JSON.stringify({
        morning: 'Recovered.', afternoon: 'Recovered too.', evening: 'And this one.',
      })))

    const res = mockRes()
    await dailyMirrorHandler({ uid: 'u1', body: { profile: {}, entries } } as any, res)

    expect(chatCompletion).toHaveBeenCalledTimes(2)
    expect(res.body.morning).toBe('Recovered.')
    expect(res.body.afternoon).toBe('Recovered too.')
    expect(res.body.evening).toBe('And this one.')
  })

  it('falls back an individual blank slot without retrying the whole call', async () => {
    chatCompletion.mockResolvedValue(modelReply(JSON.stringify({
      morning: '', afternoon: 'Afternoon holds.', evening: 'Evening holds.',
    })))

    const res = mockRes()
    await dailyMirrorHandler({ uid: 'u1', body: { profile: {}, entries } } as any, res)

    expect(chatCompletion).toHaveBeenCalledTimes(1)
    expect(res.body.morning.length).toBeGreaterThan(0) // fell back, non-empty
    expect(res.body.afternoon).toBe('Afternoon holds.')
    expect(res.body.evening).toBe('Evening holds.')
  })

  it('rejects a body without an entries array', async () => {
    const res = mockRes()
    await dailyMirrorHandler({ uid: 'u1', body: { name: 'Kon' } } as any, res)

    expect(res.statusCode).toBe(400)
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('returns 200 with every slot null when there are no entries at all', async () => {
    const res = mockRes()
    await dailyMirrorHandler({ uid: 'u1', body: { profile: {}, entries: [] } } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ morning: null, afternoon: null, evening: null, sourceEntryIds: [] })
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('returns 500 when the model call throws', async () => {
    chatCompletion.mockRejectedValue(new Error('upstream down'))

    const res = mockRes()
    await dailyMirrorHandler({ uid: 'u1', body: { profile: {}, entries } } as any, res)

    expect(res.statusCode).toBe(500)
  })
})

interface RouteLayer {
  route?: { path: string; stack: Array<{ name: string }> }
}

describe('POST /daily-mirror wiring', () => {
  it('is guarded by firebaseAuth, requirePro and requireAiConsent, in that order', () => {
    const layer = (aiRouter as unknown as { stack: RouteLayer[] }).stack
      .find(l => l.route?.path === '/daily-mirror')
    expect(layer?.route, 'no route registered for /daily-mirror').toBeTruthy()

    const names = layer!.route!.stack.map(h => h.name)
    const authIdx = names.indexOf('firebaseAuth')
    const proIdx = names.indexOf('requirePro')
    const consentIdx = names.indexOf('requireAiConsent')

    expect(authIdx, `stack was [${names.join(', ')}]`).toBeGreaterThanOrEqual(0)
    expect(proIdx).toBeGreaterThan(authIdx)
    expect(consentIdx).toBeGreaterThan(authIdx)
  })

  it('leaves /daily-encouragements registered and unchanged for old clients', () => {
    const layer = (aiRouter as unknown as { stack: RouteLayer[] }).stack
      .find(l => l.route?.path === '/daily-encouragements')
    expect(layer?.route, 'old route must stay registered for already-shipped clients').toBeTruthy()
  })
})
