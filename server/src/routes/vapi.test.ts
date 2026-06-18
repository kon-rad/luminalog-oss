// vi.mock calls are hoisted before imports. We mock config (avoids env
// validation → process.exit) and every heavy collaborator pulled in by
// vapi.ts so importing the route has no side effects.
import { vi, describe, it, expect } from 'vitest'

vi.mock('../config', () => ({
  config: {
    NODE_ENV: 'production',
    PORT: '3200',
    VAPI_PUBLIC_KEY: 'pk_test',
    VAPI_ASSISTANT_ID: 'asst_test',
    VAPI_WEBHOOK_SECRET: 'secret_test',
  },
}))
vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (_req: any, _res: any, next: any) => next(),
  db: {},
}))
vi.mock('../services/journalRetriever', () => ({ retrieveContextWithSources: vi.fn() }))
vi.mock('../services/aiClient', () => ({ chatCompletion: vi.fn() }))
vi.mock('../services/prompts', () => ({ PROMPTS: { voiceChat: () => '' } }))
vi.mock('../crypto/keyService', () => ({ getOrCreateDEK: vi.fn() }))
vi.mock('../crypto/fieldCipher', () => ({ openFieldSafe: vi.fn(), encryptField: vi.fn() }))
vi.mock('../services/voicePersistence', () => ({ persistVoiceTurn: vi.fn() }))

import jwt from 'jsonwebtoken'
import { callConfigHandler } from './vapi'
import { config } from '../config'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

// Express route pattern for the custom-LLM endpoint: /v1/vapi/llm/:token/chat/completions
function matchLlmRoute(pathname: string): { token: string } | null {
  const m = pathname.match(/^\/v1\/vapi\/llm\/([^/]+)\/chat\/completions$/)
  return m ? { token: m[1] } : null
}

describe('vapi call-config → custom-LLM url', () => {
  it('stays routable after Vapi appends /chat/completions, with a recoverable token', async () => {
    const req: any = { uid: 'user-123' }
    const res = mockRes()
    await callConfigHandler(req, res)

    const url: string = res.body.assistantOverrides.model.url
    // Vapi treats model.url as the base and requests `${url}/chat/completions`.
    // A token in the query string does NOT survive this append (the suffix lands
    // after `?token=...`), which 404s the request and ends the call. The token
    // must live in the path instead.
    const appended = url + '/chat/completions'
    const parsed = new URL(appended)

    const match = matchLlmRoute(parsed.pathname)
    expect(match).not.toBeNull()

    const decoded = jwt.verify(
      decodeURIComponent(match!.token),
      config.VAPI_WEBHOOK_SECRET,
    ) as { uid: string }
    expect(decoded.uid).toBe('user-123')
  })
})

import { parseWebhookMessage } from './vapi'

describe('vapi webhook payload parsing', () => {
  it('reads fields nested under message (Vapi wraps server messages)', () => {
    const body = {
      message: {
        type: 'end-of-call-report',
        endedReason: 'customer-ended-call',
        transcript: 'AI: hi\nUser: hello',
        recordingUrl: 'https://rec/abc.wav',
        call: { id: 'call_1', metadata: { chatId: 'chat_1' } },
        artifact: { transcript: 'AI: hi\nUser: hello' },
      },
    }
    const m = parseWebhookMessage(body)
    expect(m.type).toBe('end-of-call-report')
    expect(m.chatId).toBe('chat_1')
    expect(m.callId).toBe('call_1')
    expect(m.endedReason).toBe('customer-ended-call')
    expect(m.rawTranscript).toBe('AI: hi\nUser: hello')
    expect(m.recordingUrl).toBe('https://rec/abc.wav')
  })

  it('falls back to top-level fields when not wrapped', () => {
    const body = {
      type: 'end-of-call-report',
      call: { id: 'c2', metadata: { chatId: 'chat_2' } },
      transcript: 't',
    }
    const m = parseWebhookMessage(body)
    expect(m.chatId).toBe('chat_2')
    expect(m.callId).toBe('c2')
  })
})

import { accumulateAssistantText } from './vapi'

describe('accumulateAssistantText', () => {
  it('concatenates delta.content across SSE data lines, ignoring [DONE]', () => {
    const chunk =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n' +
      'data: [DONE]\n'
    expect(accumulateAssistantText('', chunk)).toBe('Hello')
  })
})

describe('vapi call-config overrides', () => {
  it('sets metadata.chatId, enables recording, and points the webhook server url', async () => {
    const req: any = { uid: 'user-123', body: { chatId: 'chat-9' } }
    const res = mockRes()
    await callConfigHandler(req, res)
    const ov = res.body.assistantOverrides
    expect(ov.metadata.chatId).toBe('chat-9')
    expect(ov.artifactPlan.recordingEnabled).toBe(true)
    expect(ov.server.url).toContain('/v1/vapi/webhook')
    expect(ov.serverMessages).toContain('end-of-call-report')
    // chatId rides in the LLM token so /llm can persist without a DB lookup
    const token = ov.model.url.match(/\/llm\/([^/]+)$/)![1]
    const decoded = jwt.verify(token, config.VAPI_WEBHOOK_SECRET) as any
    expect(decoded.chatId).toBe('chat-9')
  })
})
