import { vi, describe, it, expect, beforeEach } from 'vitest'

// Dual-mode (Model 1 / zero-knowledge) tests for POST /v1/chat. Flag ON + client
// plaintext (bio/profile/history/journalContext) → the prompt is built from the
// body and forwarded to Together AI; the server NEVER decrypts (getOrCreateDEK is
// not called) and does NOT persist messages (client re-encrypts in 1c-C). Flag
// OFF → byte-identical legacy path (server decrypts + persists).

const model1 = vi.hoisted(() => ({ on: false }))
vi.mock('../config', () => ({ aiModel1Enabled: () => model1.on }))

vi.mock('firebase-admin', () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => 'ts' } } },
}))

const msgSet = vi.fn(async () => {})
const chatUpdate = vi.fn(async () => {})
vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db: {
    collection: (name: string) => ({
      doc: () => ({
        get: async () => ({ data: () => (name === 'users' ? { displayName: 'Sam', biography: { v: 1 } } : {}) }),
        collection: () => ({
          orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
          doc: () => ({ set: msgSet }),
        }),
        update: chatUpdate,
      }),
    }),
  },
}))
vi.mock('../crypto/keyService', () => ({ getOrCreateDEK: vi.fn(async () => Buffer.alloc(32)) }))
vi.mock('../crypto/fieldCipher', () => ({
  openFieldSafe: vi.fn(() => 'SERVER_DECRYPTED'),
  encryptField: vi.fn(() => ({ ct: '' })),
}))
vi.mock('../services/journalRetriever', () => ({ retrieveContext: vi.fn(async () => 'LEGACY_RAG') }))
vi.mock('../services/profileContext', () => ({ decodeProfileFields: vi.fn(() => ({})) }))
// The system prompt embeds its inputs so we can assert which context reached the LLM.
vi.mock('../services/prompts', () => ({
  PROMPTS: { chatSystem: (_n: string, bio: string, _p: any, ctx: string) => `SYS ctx=${ctx} bio=${bio}` },
}))

// Hoisted so the vi.mock factory (hoisted above imports) can reference it.
const chatSpy = vi.hoisted(() => vi.fn())
vi.mock('../services/aiClient', () => ({ chatCompletion: chatSpy }))

import { chatHandler } from './chat'
import { getOrCreateDEK } from '../crypto/keyService'

// A minimal Together-AI-style SSE stream: one content delta, then [DONE].
function sseBody(text: string) {
  const enc = new TextEncoder()
  const chunks = [
    enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`),
    enc.encode('data: [DONE]\n\n'),
  ]
  let i = 0
  return { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined }) }) }
}

function mockRes() {
  const res: any = { statusCode: 200, headers: {}, written: [] as string[], headersSent: false, ended: false }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  res.setHeader = (k: string, v: string) => { res.headers[k] = v }
  res.flushHeaders = () => { res.headersSent = true }
  res.write = (s: string) => { res.written.push(s); return true }
  res.end = () => { res.ended = true; return res }
  return res
}

beforeEach(() => {
  model1.on = false
  vi.clearAllMocks()
  chatSpy.mockResolvedValue({ ok: true, body: sseBody('Hi there') })
})

describe('chatHandler dual-mode', () => {
  it('400 when chatId or message is missing', async () => {
    const res = mockRes()
    await chatHandler({ uid: 'u', body: { chatId: 'c1' } } as any, res)
    expect(res.statusCode).toBe(400)
  })

  it('legacy path (flag off): decrypts via getOrCreateDEK, streams, and persists', async () => {
    const res = mockRes()
    await chatHandler({ uid: 'u', body: { chatId: 'c1', message: 'hello' } } as any, res)
    expect(getOrCreateDEK).toHaveBeenCalledWith('u')
    // Server-side RAG context reached the LLM.
    expect(chatSpy.mock.calls[0][0][0].content).toBe('SYS ctx=LEGACY_RAG bio=SERVER_DECRYPTED')
    // Streamed the delta + terminator.
    expect(res.written.join('')).toContain('Hi there')
    expect(res.written).toContain('data: [DONE]\n\n')
    // Persisted BOTH the user message and the assistant reply.
    expect(msgSet).toHaveBeenCalledTimes(2)
    expect(chatUpdate).toHaveBeenCalledTimes(1)
  })

  it('Model 1 (flag on): builds prompt from client plaintext, no getOrCreateDEK, no persistence', async () => {
    model1.on = true
    const res = mockRes()
    await chatHandler(
      {
        uid: 'u',
        body: {
          chatId: 'c1',
          message: 'hello now',
          name: 'Al',
          bio: 'CLIENT_BIO',
          profile: {},
          journalContext: 'CLIENT_RAG',
          history: [
            { role: 'user', content: 'prev q' },
            { role: 'assistant', content: 'prev a' },
          ],
        },
      } as any,
      res,
    )
    // The core invariant: no server-side decrypt on the Model-1 path.
    expect(getOrCreateDEK).not.toHaveBeenCalled()
    // No server-side RAG — the client-supplied context is used verbatim.
    const forwarded = chatSpy.mock.calls[0][0]
    expect(forwarded[0]).toEqual({ role: 'system', content: 'SYS ctx=CLIENT_RAG bio=CLIENT_BIO' })
    // Client history is threaded through, followed by the new user turn.
    expect(forwarded).toEqual([
      { role: 'system', content: 'SYS ctx=CLIENT_RAG bio=CLIENT_BIO' },
      { role: 'user', content: 'prev q' },
      { role: 'assistant', content: 'prev a' },
      { role: 'user', content: 'hello now' },
    ])
    // Response shape unchanged: still an SSE stream.
    expect(res.written.join('')).toContain('Hi there')
    expect(res.written).toContain('data: [DONE]\n\n')
    // No server-side persistence on the Model-1 path (client persists in 1c-C).
    expect(msgSet).not.toHaveBeenCalled()
    expect(chatUpdate).not.toHaveBeenCalled()
  })

  it('flag on but no history in body → legacy decrypt path still runs', async () => {
    model1.on = true
    const res = mockRes()
    await chatHandler({ uid: 'u', body: { chatId: 'c1', message: 'hello' } } as any, res)
    expect(getOrCreateDEK).toHaveBeenCalledWith('u')
    expect(msgSet).toHaveBeenCalledTimes(2)
  })
})
