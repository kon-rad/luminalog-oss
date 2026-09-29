import { describe, it, expect, vi, beforeEach } from 'vitest'

// Same minimal-mock approach as `dailyMirror.route.test.ts`: the wiring test imports
// `ai.ts`, which pulls in a wide service graph purely to be importable.
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

import { aiRouter } from './ai'
import { userFactsHandler } from './userFacts'

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
  entries: [{ id: 'e1', date: '2026-09-21', title: 'Lease', text: 'I signed the lease in Forest City.' }],
  facts: [{ ref: 'f1', category: 'place', subject: 'Kuching', statement: 'You live in Kuching.', since: '2026-03-02', userAuthored: false }],
  rejected: [],
}

const goodReply = JSON.stringify({ ops: [
  { op: 'invalidate', ref: 'f1', reason: 'You moved.', evidence: ['e1'] },
  { op: 'add', category: 'place', subject: 'Forest City', statement: 'You live in Forest City.', evidence: ['e1'] },
] })

beforeEach(() => { chatCompletion.mockReset() })

describe('userFactsHandler', () => {
  it('returns validated ops and the model from one json-mode call', async () => {
    chatCompletion.mockResolvedValueOnce(modelReply(goodReply))
    const res = mockRes()
    await userFactsHandler({ uid: 'u1', body } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ops: [
        { op: 'invalidate', ref: 'f1', reason: 'You moved.', evidence: ['e1'] },
        { op: 'add', category: 'place', subject: 'Forest City', statement: 'You live in Forest City.', evidence: ['e1'] },
      ],
      model: 'mock-model',
    })
    expect(chatCompletion).toHaveBeenCalledTimes(1)
    const [messages, opts] = chatCompletion.mock.calls[0]
    expect(messages[0].content).toContain('I signed the lease in Forest City.')
    expect(messages[0].content).toContain('f1 | place | Kuching | You live in Kuching. | since 2026-03-02')
    expect(opts).toEqual({ response_format: { type: 'json_object' } })
  })

  it('retries once when the first reply does not parse', async () => {
    chatCompletion
      .mockResolvedValueOnce(modelReply('Here are some facts about you.'))
      .mockResolvedValueOnce(modelReply('{"ops":[]}'))
    const res = mockRes()
    await userFactsHandler({ uid: 'u1', body } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ops: [], model: 'mock-model' })
    expect(chatCompletion).toHaveBeenCalledTimes(2)
  })

  it('returns 502 with no fallback after two unparseable replies', async () => {
    chatCompletion.mockResolvedValue(modelReply('nope'))
    const res = mockRes()
    await userFactsHandler({ uid: 'u1', body } as any, res)
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: 'User facts extraction failed' })
  })

  it('returns 502 when the provider errors, without logging the request body', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    chatCompletion.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const res = mockRes()
    await userFactsHandler({ uid: 'u1', body } as any, res)
    expect(res.statusCode).toBe(502)
    const logged = errors.mock.calls.map(args => args.map(String).join(' ')).join('\n')
    expect(logged).not.toContain('Forest City')
    errors.mockRestore()
  })

  it('returns 400 for an invalid body without calling the model', async () => {
    const res = mockRes()
    await userFactsHandler({ uid: 'u1', body: { entries: [] } } as any, res)
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'No entries to read' })
    expect(chatCompletion).not.toHaveBeenCalled()
  })
})

describe('/user-facts route wiring', () => {
  interface RouteLayer { route?: { path: string; stack: Array<{ name: string }> } }

  it('is behind firebaseAuth, requirePro, and requireAiConsent', () => {
    const layer = (aiRouter as unknown as { stack: RouteLayer[] }).stack
      .find(l => l.route?.path === '/user-facts')
    expect(layer?.route, 'no route registered for /user-facts').toBeTruthy()

    const names = layer!.route!.stack.map(h => h.name)
    const authIdx = names.indexOf('firebaseAuth')
    expect(authIdx, `stack was [${names.join(', ')}]`).toBeGreaterThanOrEqual(0)
    expect(names.indexOf('requirePro')).toBeGreaterThan(authIdx)
    expect(names.indexOf('requireAiConsent')).toBeGreaterThan(authIdx)
  })
})
