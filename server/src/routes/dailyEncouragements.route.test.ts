import { describe, it, expect, vi, beforeEach } from 'vitest'

// `ai.ts` pulls in a wide service graph (AI client, ffmpeg audio extraction, S3,
// the Base/CDP chain stack, Firestore, config's Zod env validation) purely to be
// importable. None of that matters here, so everything below is mocked to the
// bare minimum needed for a clean import. Mirrors `aiConsent.route.test.ts`.
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

import { aiRouter, dailyEncouragementsHandler } from './ai'

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

describe('dailyEncouragementsHandler', () => {
  it('returns five messages and the source entry ids', async () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, body: `B${i}` }))
    chatCompletion.mockResolvedValue(modelReply(JSON.stringify({ messages })))

    const res = mockRes()
    await dailyEncouragementsHandler({ uid: 'u1', body: { name: 'Kon', profile: {}, entries } } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.messages).toHaveLength(5)
    expect(res.body.messages[0]).toEqual({ title: 'T0', body: 'B0' })
    expect(res.body.sourceEntryIds).toEqual(['e1'])
    expect(chatCompletion).toHaveBeenCalledTimes(1)
  })

  it('sends the entry text to the model as plaintext context', async () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, body: `B${i}` }))
    chatCompletion.mockResolvedValue(modelReply(JSON.stringify({ messages })))

    await dailyEncouragementsHandler(
      { uid: 'u1', body: { name: 'Kon Gnat', profile: { goals: 'ship it' }, entries } } as any,
      mockRes(),
    )

    const systemPrompt = chatCompletion.mock.calls[0][0][0].content as string
    expect(systemPrompt).toContain('I kept avoiding the hard call.')
    expect(systemPrompt).toContain('ship it')
    // Only the first name is passed through, matching the other AI routes.
    expect(systemPrompt).toContain('Kon')
    expect(systemPrompt).not.toContain('Kon Gnat')
  })

  it('rejects a body without an entries array', async () => {
    const res = mockRes()
    await dailyEncouragementsHandler({ uid: 'u1', body: { name: 'Kon' } } as any, res)

    expect(res.statusCode).toBe(400)
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('retries once on unparseable output, then falls back', async () => {
    chatCompletion.mockResolvedValue(modelReply('I cannot help with that.'))

    const res = mockRes()
    await dailyEncouragementsHandler({ uid: 'u1', body: { profile: {}, entries } } as any, res)

    expect(chatCompletion).toHaveBeenCalledTimes(2)
    expect(res.statusCode).toBe(200)
    expect(res.body.messages).toHaveLength(5)
    expect(res.body.messages[0].body.length).toBeGreaterThan(0)
  })

  it('returns 200 with an empty list when there are no entries at all', async () => {
    const res = mockRes()
    await dailyEncouragementsHandler({ uid: 'u1', body: { profile: {}, entries: [] } } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.messages).toEqual([])
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('returns 500 when the model call throws', async () => {
    chatCompletion.mockRejectedValue(new Error('upstream down'))

    const res = mockRes()
    await dailyEncouragementsHandler({ uid: 'u1', body: { profile: {}, entries } } as any, res)

    expect(res.statusCode).toBe(500)
  })
})

interface RouteLayer {
  route?: { path: string; stack: Array<{ name: string }> }
}

describe('POST /daily-encouragements wiring', () => {
  it('is guarded by firebaseAuth, requirePro and requireAiConsent, in that order', () => {
    const layer = (aiRouter as unknown as { stack: RouteLayer[] }).stack
      .find(l => l.route?.path === '/daily-encouragements')
    expect(layer?.route, 'no route registered for /daily-encouragements').toBeTruthy()

    const names = layer!.route!.stack.map(h => h.name)
    const authIdx = names.indexOf('firebaseAuth')
    const proIdx = names.indexOf('requirePro')
    const consentIdx = names.indexOf('requireAiConsent')

    expect(authIdx, `stack was [${names.join(', ')}]`).toBeGreaterThanOrEqual(0)
    expect(proIdx).toBeGreaterThan(authIdx)
    expect(consentIdx).toBeGreaterThan(authIdx)
  })
})
