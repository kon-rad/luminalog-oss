import { describe, it, expect, vi, beforeEach } from 'vitest'

const chatCompletion = vi.fn()

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: function firebaseAuth(req: any, _res: any, next: any) { req.uid = 'u'; next() },
  db: {},
}))
vi.mock('../middleware/requireAiConsent', () => ({ requireAiConsent: function requireAiConsent(_r: any, _res: any, next: any) { next() } }))
vi.mock('../config', () => ({ config: {}, enforceAiConsentEnabled: () => false }))
vi.mock('../services/aiClient', () => ({
  chatCompletion: (...args: any[]) => chatCompletion(...args),
  resolveVoiceProvider: () => ({ name: 'venice', chatModel: 'voice-model' }),
}))

import { voiceTurnRouter, voiceTurnHandler, mergeConsecutiveRoles } from './voiceTurn'

/** A streaming upstream reply made of OpenAI-style SSE chunks. */
function streamReply(deltas: string[]) {
  const encoder = new TextEncoder()
  const frames = deltas.map(d => `data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n\n`)
  frames.push('data: [DONE]\n\n')
  let i = 0
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () =>
          i < frames.length ? { done: false, value: encoder.encode(frames[i++]) } : { done: true, value: undefined },
      }),
    },
  }
}

function mockRes() {
  const res: any = { statusCode: 200, headersSent: false, written: [] as string[] }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  res.setHeader = vi.fn()
  res.flushHeaders = vi.fn(() => { res.headersSent = true })
  res.write = vi.fn((s: string) => { res.written.push(s); return true })
  res.end = vi.fn()
  return res
}

function body(over: Record<string, any> = {}) {
  return {
    chatId: 'chat-12345678',
    message: 'What did I write about the launch?',
    history: [
      { role: 'assistant', content: 'Hi, Konrad.' },
      { role: 'user', content: 'Hey.' },
    ],
    name: 'Konrad',
    bio: 'A builder.',
    profile: { goals: 'ship it' },
    todayContext: 'TODAY-ENTRY',
    ragContext: 'PAST-ENTRY',
    memoryContext: 'MEMORY-LADDER',
    focalEntry: 'FOCAL-ENTRY',
    now: '2026-11-15 10:00 JST',
    ...over,
  }
}

beforeEach(() => { chatCompletion.mockReset() })

describe('voiceTurn route', () => {
  it('is mounted behind auth and AI consent', () => {
    const layer = (voiceTurnRouter as any).stack.find((l: any) => l.route?.path === '/' && l.route?.methods?.post)
    expect(layer).toBeTruthy()
    const names = layer.route.stack.map((s: any) => s.name)
    expect(names).toEqual(['firebaseAuth', 'requireAiConsent', 'voiceTurnHandler'])
  })

  it('streams deltas as SSE and ends with [DONE]', async () => {
    chatCompletion.mockResolvedValue(streamReply(['Hello ', 'there.']))
    const res = mockRes()
    await voiceTurnHandler({ body: body() } as any, res)

    expect(res.written).toEqual([
      'data: {"delta":"Hello "}\n\n',
      'data: {"delta":"there."}\n\n',
      'data: [DONE]\n\n',
    ])
    expect(res.end).toHaveBeenCalled()
  })

  it('builds the voice prompt from client context and uses the voice provider', async () => {
    chatCompletion.mockResolvedValue(streamReply(['ok']))
    await voiceTurnHandler({ body: body() } as any, mockRes())

    const [messages, opts] = chatCompletion.mock.calls[0]
    expect(messages[0].role).toBe('system')
    for (const marker of ['TODAY-ENTRY', 'PAST-ENTRY', 'MEMORY-LADDER', 'FOCAL-ENTRY', '2026-11-15 10:00 JST', 'Konrad']) {
      expect(messages[0].content).toContain(marker)
    }
    expect(messages.slice(1)).toEqual([
      { role: 'assistant', content: 'Hi, Konrad.' },
      { role: 'user', content: 'Hey.\nWhat did I write about the launch?' },
    ])
    expect(opts.stream).toBe(true)
    expect(opts.provider).toEqual({ name: 'venice', chatModel: 'voice-model' })
    expect(opts.retry.timeoutMs).toBeLessThanOrEqual(6_000)
  })

  it('ignores a dek field: the route never takes the user key', async () => {
    chatCompletion.mockResolvedValue(streamReply(['ok']))
    await voiceTurnHandler({ body: body({ dek: 'c2VjcmV0LWtleQ==' }) } as any, mockRes())
    expect(JSON.stringify(chatCompletion.mock.calls[0])).not.toContain('c2VjcmV0LWtleQ==')
  })

  it('rejects a body without a message', async () => {
    const res = mockRes()
    await voiceTurnHandler({ body: body({ message: '' }) } as any, res)
    expect(res.statusCode).toBe(400)
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('returns 502 when the voice model is unavailable, before any stream starts', async () => {
    chatCompletion.mockResolvedValue({ ok: false, status: 503, body: null, text: async () => 'busy' })
    const res = mockRes()
    await voiceTurnHandler({ body: body() } as any, res)
    expect(res.statusCode).toBe(502)
    expect(res.written).toEqual([])
  })

  it('returns 500 when the provider call throws', async () => {
    chatCompletion.mockRejectedValue(new Error('timeout'))
    const res = mockRes()
    await voiceTurnHandler({ body: body() } as any, res)
    expect(res.statusCode).toBe(500)
  })
})

describe('mergeConsecutiveRoles', () => {
  it('joins back-to-back turns from the same speaker and drops empty ones', () => {
    expect(
      mergeConsecutiveRoles([
        { role: 'user', content: 'one' },
        { role: 'user', content: 'two' },
        { role: 'assistant', content: '  ' },
        { role: 'assistant', content: 'three' },
        { role: 'user', content: 'four' },
      ]),
    ).toEqual([
      { role: 'user', content: 'one\ntwo' },
      { role: 'assistant', content: 'three' },
      { role: 'user', content: 'four' },
    ])
  })
})

describe('voiceTurn route, life interview', () => {
  it('uses the interviewer prompt and no journal context', async () => {
    chatCompletion.mockResolvedValue(streamReply(['[#B2] ', 'What changed?']))
    await voiceTurnHandler(
      { body: body({ interview: { section: 'B', item: 'B2', resumed: true } }) } as any,
      mockRes(),
    )

    const system = chatCompletion.mock.calls[0][0][0].content as string
    expect(system).toContain('life story interview')
    expect(system).toContain('B2 (Turning point)')
    expect(system).toContain('the current question is B2')
    expect(system).toContain('coming back')
    for (const leaked of ['TODAY-ENTRY', 'PAST-ENTRY', 'MEMORY-LADDER', 'FOCAL-ENTRY', 'A builder.']) {
      expect(system).not.toContain(leaked)
    }
  })

  it('strips the leading tag from speech and reports it as an interview event', async () => {
    chatCompletion.mockResolvedValue(streamReply(['[#', 'B3', '] Thank you. ', 'A happy early memory?']))
    const res = mockRes()
    await voiceTurnHandler({ body: body({ interview: { section: 'B', item: 'B2' } }) } as any, res)

    expect(res.written).toEqual([
      'data: {"interview":{"item":"B3","sectionComplete":false}}\n\n',
      'data: {"delta":"Thank you. "}\n\n',
      'data: {"delta":"A happy early memory?"}\n\n',
      'data: [DONE]\n\n',
    ])
  })

  it('reports the end of the section', async () => {
    chatCompletion.mockResolvedValue(streamReply(['[#DONE] That is the end of this part.']))
    const res = mockRes()
    await voiceTurnHandler({ body: body({ interview: { section: 'G', item: 'G2' } }) } as any, res)
    expect(res.written[0]).toBe('data: {"interview":{"item":null,"sectionComplete":true}}\n\n')
    expect(res.written[1]).toBe('data: {"delta":"That is the end of this part."}\n\n')
  })

  it('speaks an untagged reply unchanged', async () => {
    chatCompletion.mockResolvedValue(streamReply(['Take ', 'your time.']))
    const res = mockRes()
    await voiceTurnHandler({ body: body({ interview: { section: 'A' } }) } as any, res)
    expect(res.written).toEqual([
      'data: {"delta":"Take "}\n\n',
      'data: {"delta":"your time."}\n\n',
      'data: [DONE]\n\n',
    ])
  })

  it('falls back to the first question when the item is unknown', async () => {
    chatCompletion.mockResolvedValue(streamReply(['ok']))
    await voiceTurnHandler({ body: body({ interview: { section: 'D', item: 'Z9' } }) } as any, mockRes())
    expect(chatCompletion.mock.calls[0][0][0].content).toContain('the current question is D1')
  })

  it('rejects an unknown section', async () => {
    const res = mockRes()
    await voiceTurnHandler({ body: body({ interview: { section: 'X' } }) } as any, res)
    expect(res.statusCode).toBe(400)
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('serves the script behind auth', () => {
    const layer = (voiceTurnRouter as any).stack.find(
      (l: any) => l.route?.path === '/interview-script' && l.route?.methods?.get,
    )
    expect(layer).toBeTruthy()
    expect(layer.route.stack[0].name).toBe('firebaseAuth')
    const res = mockRes()
    layer.route.stack[1].handle({} as any, res)
    expect(res.body.sections.map((s: any) => s.key)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })
})
