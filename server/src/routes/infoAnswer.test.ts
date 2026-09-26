import { describe, it, expect, vi, beforeEach } from 'vitest'

const chatCompletion = vi.fn()

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: function firebaseAuth(req: any, _res: any, next: any) { req.uid = 'u'; next() },
  db: {},
}))
vi.mock('../middleware/requireAiConsent', () => ({ requireAiConsent: function requireAiConsent(_r: any, _res: any, next: any) { next() } }))
vi.mock('../config', () => ({ config: {}, enforceAiConsentEnabled: () => false }))
vi.mock('../services/aiClient', () => ({ chatCompletion: (...args: any[]) => chatCompletion(...args) }))

import { infoAnswerRouter } from './infoAnswer'

function modelReply(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }
}

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

function body(over: Record<string, any> = {}) {
  return {
    name: 'Konrad',
    bio: 'A builder.',
    profile: { goals: 'ship it' },
    sender: { name: 'AlphaAgent', description: 'A friendly agent' },
    reason: 'Collaboration inquiry',
    items: [
      { question: 'What are you working on?', journalContext: 'I am building a new feature for the app.' },
    ],
    ...over,
  }
}

beforeEach(() => { chatCompletion.mockReset() })

/**
 * Extract the route handler from the router stack so we can call it directly
 * without starting an Express server.
 */
function getHandler() {
  const layer = (infoAnswerRouter as any).stack.find(
    (l: any) => l.route?.path === '/' && l.route?.methods?.post,
  )
  expect(layer, 'POST / route not found on infoAnswerRouter').toBeTruthy()
  // The handler is the last middleware in the route stack (after firebaseAuth and requireAiConsent).
  const handler = layer.route.stack[layer.route.stack.length - 1].handle
  return handler
}

describe('infoAnswer handler', () => {
  it('returns one answer per item', async () => {
    chatCompletion.mockResolvedValue(modelReply('I am building a new feature for the app.'))

    const res = mockRes()
    await getHandler()({ body: body() } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.answers).toHaveLength(1)
    expect(res.body.answers[0]).toBe('I am building a new feature for the app.')
    expect(chatCompletion).toHaveBeenCalledTimes(1)
  })

  it('returns answers for multiple items in order', async () => {
    chatCompletion
      .mockResolvedValueOnce(modelReply('Answer one.'))
      .mockResolvedValueOnce(modelReply('Answer two.'))

    const res = mockRes()
    await getHandler()({
      body: body({ items: [
        { question: 'Q1?', journalContext: 'ctx1' },
        { question: 'Q2?', journalContext: 'ctx2' },
      ] }),
    } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.answers).toHaveLength(2)
    expect(res.body.answers[0]).toBe('Answer one.')
    expect(res.body.answers[1]).toBe('Answer two.')
    expect(chatCompletion).toHaveBeenCalledTimes(2)
  })

  it('wraps sender info as untrusted_request in the user message', async () => {
    chatCompletion.mockResolvedValue(modelReply('My answer.'))

    const res = mockRes()
    await getHandler()({ body: body() } as any, res)

    const userMessage = chatCompletion.mock.calls[0][0][1].content as string
    expect(userMessage).toContain('<untrusted_request>')
    expect(userMessage).toContain('Sender: AlphaAgent')
    expect(userMessage).toContain('About the sender: A friendly agent')
    expect(userMessage).toContain('Reason for asking: Collaboration inquiry')
    expect(userMessage).toContain('Question: What are you working on?')
    expect(userMessage).toContain('</untrusted_request>')
    expect(userMessage).toContain('RELEVANT JOURNAL EXCERPTS:')
  })

  it('uses NO_ANSWER when model returns empty content', async () => {
    chatCompletion.mockResolvedValue(modelReply(''))

    const res = mockRes()
    await getHandler()({ body: body() } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.answers[0]).toBe('')
  })

  it('returns 400 when items array is missing', async () => {
    const res = mockRes()
    await getHandler()({ body: { sender: { name: 'A', description: 'B' }, reason: 'r' } } as any, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_body')
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('returns 400 when items array is too large (over 10)', async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ question: `Q${i}?`, journalContext: '' }))

    const res = mockRes()
    await getHandler()({ body: body({ items }) } as any, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_body')
    expect(chatCompletion).not.toHaveBeenCalled()
  })

  it('returns 500 when the AI provider fails', async () => {
    chatCompletion.mockResolvedValue({ ok: false, status: 502 })

    const res = mockRes()
    await getHandler()({ body: body() } as any, res)

    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('answer_drafting_failed')
  })

  it('returns 500 when chatCompletion throws', async () => {
    chatCompletion.mockRejectedValue(new Error('upstream down'))

    const res = mockRes()
    await getHandler()({ body: body() } as any, res)

    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('answer_drafting_failed')
  })

  it('defaults missing bio, profile, and name to empty values', async () => {
    chatCompletion.mockResolvedValue(modelReply('Answer.'))

    const res = mockRes()
    await getHandler()({
      body: {
        sender: { name: 'A', description: 'B' },
        reason: 'r',
        items: [{ question: 'Q?', journalContext: 'ctx' }],
      },
    } as any, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.answers).toHaveLength(1)
    expect(chatCompletion).toHaveBeenCalledTimes(1)

    const systemMsg = chatCompletion.mock.calls[0][0][0].content as string
    expect(systemMsg).toContain('No biography provided.')
  })
})

describe('POST / infoAnswer wiring', () => {
  it('carries firebaseAuth then requireAiConsent then handler', () => {
    const layer = (infoAnswerRouter as any).stack.find(
      (l: any) => l.route?.path === '/' && l.route?.methods?.post,
    )
    expect(layer?.route, 'no route registered for POST /').toBeTruthy()

    const names = layer!.route!.stack.map((h: any) => h.name)
    const authIdx = names.indexOf('firebaseAuth')
    const consentIdx = names.indexOf('requireAiConsent')
    const handlerIdx = names.indexOf('infoAnswerHandler')

    expect(authIdx, `stack was [${names.join(', ')}]`).toBeGreaterThanOrEqual(0)
    expect(consentIdx).toBeGreaterThan(authIdx)
    expect(handlerIdx).toBeGreaterThan(consentIdx)
  })
})