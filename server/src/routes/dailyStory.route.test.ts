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

import { dailyPromptHandler } from './ai'

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

describe('daily story prompts', () => {
  it('adds a story in the same call, preserving legacy fields and five areas', async () => {
    chatCompletion.mockResolvedValue(modelReply(JSON.stringify({ prompts: [], story: { question: 'What choice stood out for you today?' } })))
    const res = mockRes()
    await dailyPromptHandler({ uid: 'u', body: { entries, storyType: 'choice' } } as any, res)
    expect(chatCompletion).toHaveBeenCalledTimes(1)
    expect(res.body.prompts).toHaveLength(5)
    expect(res.body.text).toBe(res.body.prompts[0].text)
    expect(res.body.sourceEntryIds).toEqual(['e1'])
    expect(res.body.story).toEqual({ area: 'Deliberate choice', storyType: 'choice', text: 'What choice stood out for you today?' })
    expect(chatCompletion.mock.calls[0][0][0].content).toContain('No advice, praise')
  })
  it('leaves legacy requests free of the story field', async () => {
    chatCompletion.mockResolvedValue(modelReply('{"prompts":[]}'))
    const res = mockRes()
    await dailyPromptHandler({ uid: 'u', body: { entries } } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toHaveProperty('story')
  })
  it.each(['__proto__', 'invalid', null, {}, ['scene']])('rejects invalid type %s before calling AI', async (storyType) => {
    const res = mockRes()
    await dailyPromptHandler({ uid: 'u', body: { entries, storyType } } as any, res)
    expect(res.statusCode).toBe(400)
    expect(chatCompletion).not.toHaveBeenCalled()
  })
  it('uses a local fallback for a malformed story without another model call', async () => {
    chatCompletion.mockResolvedValue(modelReply('{"prompts":[],"story":{"question":"One? Two?"}}'))
    const res = mockRes()
    await dailyPromptHandler({ uid: 'u', body: { entries, storyType: 'scene' } } as any, res)
    expect(chatCompletion).toHaveBeenCalledTimes(1)
    expect(res.body.story.text).toBe('What is one moment from today you would want to remember?')
  })
})
