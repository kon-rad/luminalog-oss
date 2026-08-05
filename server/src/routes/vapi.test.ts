// vi.mock calls are hoisted before imports. We mock config (avoids env
// validation → process.exit) and every heavy collaborator pulled in by
// vapi.ts so importing the route has no side effects.
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../config', () => ({
  config: {
    NODE_ENV: 'production',
    PORT: '3200',
    VAPI_PUBLIC_KEY: 'pk_test',
    VAPI_ASSISTANT_ID: 'asst_test',
    VAPI_WEBHOOK_SECRET: 'secret_test',
    // Voice model routing now resolves via the mocked `resolveVoiceProvider`
    // below, not by reading config directly (ADR-0109).
    VOICE_AI_PROVIDER: 'together',
  },
}))
vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (_req: any, _res: any, next: any) => next(),
  db: {},
}))
vi.mock('../services/prompts', () => ({ PROMPTS: { voiceChat: vi.fn(() => 'VOICE_SYSTEM_PROMPT') } }))
vi.mock('../services/ragStore', () => ({ searchChunks: vi.fn(async () => []) }))
vi.mock('../services/aiClient', () => ({
  chatCompletion: vi.fn(),
  // The voice turn resolves its provider independently of the global AI_PROVIDER
  // (ADR-0109); the proxy calls this on every turn.
  resolveVoiceProvider: vi.fn(() => ({
    name: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    apiKey: 'k',
    chatModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    embeddingModel: 'e',
  })),
}))
vi.mock('../services/voiceRecordingStore', () => ({
  stageRecording: vi.fn(),
  deleteStaging: vi.fn(),
  stagingKey: (uid: string, callId: string) => `users/${uid}/voice-staging/${callId}.wav`,
  finalRecordingKey: (uid: string, callId: string) => `users/${uid}/voice/${callId}.wav`,
}))

import { callConfigHandler, llmProxyHandler } from './vapi'
import { config } from '../config'
import { PROMPTS } from '../services/prompts'
import { searchChunks } from '../services/ragStore'
import { chatCompletion } from '../services/aiClient'
import { createSession, _clearAllSessions } from '../services/voiceCallSessions'
import { encryptField } from '../crypto/fieldCipher'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

// An SSE-capable response mock: records header calls + every written chunk.
function mockSseRes() {
  const res: any = { statusCode: 200, headersSent: false, writes: [] as string[] }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  res.setHeader = vi.fn(() => res)
  res.flushHeaders = vi.fn(() => { res.headersSent = true })
  res.write = vi.fn((c: any) => { res.writes.push(Buffer.isBuffer(c) ? c.toString('utf8') : String(c)); return true })
  res.end = vi.fn(() => { res.ended = true; return res })
  return res
}

// A Firestore-Admin-shaped mock for the `journals` collection.
function journalsDbMock(byId: Record<string, any>) {
  return {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: () => Promise.resolve({ data: () => (name === 'journals' ? byId[id] : undefined) }),
      }),
    }),
  } as any
}

// Build an OpenAI-shaped streaming Response the upstream (Morpheus) would return.
function sseResponse(content: string, status = 200): Response {
  const body =
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n` +
    'data: [DONE]\n\n'
  return new Response(body, { status })
}

describe('vapi call-config → dashboard model + injected system prompt', () => {
  it('injects the system prompt via variableValues and sends NO model override', async () => {
    const req: any = { uid: 'user-123', body: { ragContext: 'ctx' } }
    const res = mockRes()
    await callConfigHandler(req, res)

    const ov = res.body.assistantOverrides
    // No `model` override: Vapi validates any model object as complete and rejects the
    // call for a missing provider. The dashboard owns model/provider/params (ADR-0077).
    expect(ov.model).toBeUndefined()
    // The per-call system prompt rides in `variableValues.systemPrompt`, substituted
    // into the dashboard prompt's `{{systemPrompt}}` placeholder.
    expect(ov.variableValues.systemPrompt).toBe('VOICE_SYSTEM_PROMPT')
  })

  it('forwards the client-sent local `now` and today-context to voiceChat', async () => {
    const req: any = {
      uid: 'user-123',
      body: { ragContext: 'ctx', now: '2026-07-13 14:29 PDT', todayContext: 'today-block' },
    }
    const res = mockRes()
    await callConfigHandler(req, res)

    // voiceChat(name, bio, profile, ragContext, focalEntry, currentDateTime, todayEntries)
    expect(PROMPTS.voiceChat).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      'ctx', undefined, '2026-07-13 14:29 PDT', 'today-block',
    )
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

  it('finds chatId in assistantOverrides.metadata (where Vapi actually puts it)', () => {
    const body = {
      message: {
        type: 'end-of-call-report',
        call: { id: 'c3', metadata: {}, assistantOverrides: { metadata: { chatId: 'chat_3' } } },
      },
    }
    expect(parseWebhookMessage(body).chatId).toBe('chat_3')
  })

  it('finds chatId in assistant.metadata as a further fallback', () => {
    const body = { message: { type: 'end-of-call-report', assistant: { metadata: { chatId: 'chat_4' } } } }
    expect(parseWebhookMessage(body).chatId).toBe('chat_4')
  })

  it('extracts the recording string URL (artifact.recording is an object, not a url)', () => {
    const body = {
      message: {
        type: 'end-of-call-report',
        artifact: {
          transcript: 'AI: hi\n',
          recordingUrl: 'https://storage.vapi.ai/mono.wav',
          recording: { stereoUrl: 'https://storage.vapi.ai/stereo.wav', mono: { combinedUrl: 'https://storage.vapi.ai/combined.wav' } },
        },
      },
    }
    const m = parseWebhookMessage(body)
    expect(m.recordingUrl).toBe('https://storage.vapi.ai/mono.wav')
    expect(m.rawTranscript).toBe('AI: hi\n')
  })

  it('falls back to mono.combinedUrl when artifact.recordingUrl is absent', () => {
    const body = { message: { type: 'end-of-call-report', artifact: { recording: { mono: { combinedUrl: 'https://c.wav' } } } } }
    expect(parseWebhookMessage(body).recordingUrl).toBe('https://c.wav')
  })

  it('reads durationSeconds from explicit field', () => {
    const body = { message: { type: 'end-of-call-report', durationSeconds: 90.5 } }
    expect(parseWebhookMessage(body).durationSeconds).toBe(90.5)
  })

  it('calculates durationSeconds from call startedAt/endedAt when no explicit field', () => {
    const body = {
      message: {
        type: 'end-of-call-report',
        call: {
          id: 'c1',
          metadata: { chatId: 'chat_1' },
          startedAt: '2024-01-01T00:00:00.000Z',
          endedAt: '2024-01-01T00:01:30.000Z',
        },
      },
    }
    expect(parseWebhookMessage(body).durationSeconds).toBeCloseTo(90, 0)
  })

  it('returns null durationSeconds when neither field nor timestamps present', () => {
    const body = { message: { type: 'end-of-call-report' } }
    expect(parseWebhookMessage(body).durationSeconds).toBeNull()
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
  })
})

import { webhookHandler } from './vapi'
import { stageRecording, deleteStaging } from '../services/voiceRecordingStore'

function chatDbMock(chatData: any) {
  const update = vi.fn().mockResolvedValue(undefined)
  const db: any = {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ data: () => chatData }),
        update,
      }),
    }),
  }
  return { db, update }
}

describe('vapi webhook — recording staging', () => {
  it('stages the recording and writes pendingRecordingKey + duration', async () => {
    ;(stageRecording as any).mockResolvedValue('users/user-1/voice-staging/call_1.wav')
    const { db, update } = chatDbMock({ userId: 'user-1' })
    const req: any = {
      query: { secret: 'secret_test' },
      headers: {},
      body: { message: { type: 'end-of-call-report', durationSeconds: 42,
        call: { id: 'call_1', metadata: { chatId: 'chat_1' } },
        artifact: { recordingUrl: 'https://storage.vapi.ai/x.wav' } } },
    }
    const res = mockRes()
    await webhookHandler(req, res, db)
    expect(stageRecording).toHaveBeenCalledWith('user-1', 'call_1', 'https://storage.vapi.ai/x.wav')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ pendingRecordingKey: 'users/user-1/voice-staging/call_1.wav', recordingDurationSeconds: 42 }),
    )
    expect(res.body).toEqual({ ok: true })
  })

  it('still acks (200) and writes nothing when the download fails', async () => {
    ;(stageRecording as any).mockResolvedValue(null)
    const { db, update } = chatDbMock({ userId: 'user-1' })
    const req: any = {
      query: { secret: 'secret_test' }, headers: {},
      body: { message: { type: 'end-of-call-report',
        call: { id: 'call_1', metadata: { chatId: 'chat_1' } },
        artifact: { recordingUrl: 'https://storage.vapi.ai/x.wav' } } },
    }
    const res = mockRes()
    await webhookHandler(req, res, db)
    expect(update).not.toHaveBeenCalled()
    expect(res.body).toEqual({ ok: true })
  })

  it('rejects a bad secret with 401', async () => {
    const { db } = chatDbMock({ userId: 'user-1' })
    const req: any = { query: { secret: 'wrong' }, headers: {}, body: {} }
    const res = mockRes()
    await webhookHandler(req, res, db)
    expect(res.statusCode).toBe(401)
  })

  it('does not stage when callId is missing', async () => {
    ;(stageRecording as any).mockClear()
    const { db, update } = chatDbMock({ userId: 'user-1' })
    const req: any = {
      query: { secret: 'secret_test' }, headers: {},
      body: { message: { type: 'end-of-call-report',
        call: { metadata: { chatId: 'chat_1' } },   // no id
        artifact: { recordingUrl: 'https://storage.vapi.ai/x.wav' } } },
    }
    const res = mockRes()
    await webhookHandler(req, res, db)
    expect(stageRecording).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(res.body).toEqual({ ok: true })
  })
})

import { recordingFinalizeHandler } from './vapi'

describe('recording-finalize handler', () => {
  it('sets recordingPath, clears pendingRecordingKey, deletes staging', async () => {
    const { db, update } = chatDbMock({ userId: 'user-1', pendingRecordingKey: 'users/user-1/voice-staging/c.wav' })
    const req: any = { uid: 'user-1', body: { chatId: 'chat-1', recordingPath: 'users/user-1/voice/c.wav' } }
    const res = mockRes()
    await recordingFinalizeHandler(req, res, db)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ recordingPath: 'users/user-1/voice/c.wav' }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ pendingRecordingKey: expect.anything() }))
    expect(deleteStaging).toHaveBeenCalledWith('users/user-1/voice-staging/c.wav')
    expect(res.body).toEqual({ ok: true })
  })

  it('403s when the recordingPath is outside the caller namespace', async () => {
    const { db } = chatDbMock({ userId: 'user-1' })
    const req: any = { uid: 'user-1', body: { chatId: 'chat-1', recordingPath: 'users/other/voice/c.wav' } }
    const res = mockRes()
    await recordingFinalizeHandler(req, res, db)
    expect(res.statusCode).toBe(403)
  })

  it('403s when the chat belongs to someone else', async () => {
    const { db } = chatDbMock({ userId: 'other' })
    const req: any = { uid: 'user-1', body: { chatId: 'chat-1', recordingPath: 'users/user-1/voice/c.wav' } }
    const res = mockRes()
    await recordingFinalizeHandler(req, res, db)
    expect(res.statusCode).toBe(403)
  })

  it('400s when fields are missing', async () => {
    const { db } = chatDbMock({ userId: 'user-1' })
    const req: any = { uid: 'user-1', body: { chatId: 'chat-1' } }
    const res = mockRes()
    await recordingFinalizeHandler(req, res, db)
    expect(res.statusCode).toBe(400)
  })
})

// ── custom-LLM proxy path ─────────────────────────────────────────────────────

describe('vapi call-config → custom-LLM proxy when dek is present', () => {
  beforeEach(() => _clearAllSessions())

  it('returns a custom-llm model with the /llm/<token> url and NO systemPrompt', async () => {
    const dek = Buffer.alloc(32, 3).toString('base64')
    const req: any = { uid: 'user-123', body: { chatId: 'chat-9', dek } }
    const res = mockRes()
    await callConfigHandler(req, res)

    const ov = res.body.assistantOverrides
    expect(ov.model.provider).toBe('custom-llm')
    expect(ov.model.model).toBe('custom')
    expect(ov.model.url).toMatch(/\/v1\/vapi\/llm\/[0-9a-f]{48}\/chat\/completions$/)
    // Custom-LLM path must NOT bake the prompt into variableValues.
    expect(ov.variableValues).toBeUndefined()
    // Shared overrides still present.
    expect(ov.metadata.chatId).toBe('chat-9')
    expect(ov.artifactPlan.recordingEnabled).toBe(true)
    expect(ov.serverMessages).toContain('end-of-call-report')
  })

  it('keeps the legacy variableValues.systemPrompt path (no model) when dek is absent', async () => {
    const req: any = { uid: 'user-123', body: { chatId: 'chat-9', ragContext: 'ctx' } }
    const res = mockRes()
    await callConfigHandler(req, res)
    const ov = res.body.assistantOverrides
    expect(ov.model).toBeUndefined()
    expect(ov.variableValues.systemPrompt).toBe('VOICE_SYSTEM_PROMPT')
  })
})

describe('vapi /llm/:token proxy', () => {
  beforeEach(() => {
    _clearAllSessions()
    ;(searchChunks as any).mockReset().mockResolvedValue([])
    ;(chatCompletion as any).mockReset().mockResolvedValue(sseResponse('Hello there'))
    ;(PROMPTS.voiceChat as any).mockClear()
  })

  const dek = Buffer.alloc(32, 9)

  function makeSession(overrides: Record<string, unknown> = {}) {
    return createSession({
      uid: 'user-1', chatId: 'chat-1', dek, name: 'Ada', bio: 'bio',
      profile: {}, todayContext: '', ...overrides,
    } as any)
  }

  it('rejects an unknown/expired token with 401', async () => {
    const req: any = { params: { token: 'nope' }, body: { messages: [] } }
    const res = mockSseRes()
    await llmProxyHandler(req, res, journalsDbMock({}))
    expect(res.statusCode).toBe(401)
  })

  it('streams an OpenAI-shaped pass-through completion verbatim', async () => {
    const token = makeSession()
    const req: any = { params: { token }, body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }
    const res = mockSseRes()
    await llmProxyHandler(req, res, journalsDbMock({}))
    const out = res.writes.join('')
    // Upstream bytes are passed through unchanged (delta shape, not chat.ts's {delta}).
    expect(out).toContain('"delta":{"content":"Hello there"}')
    expect(out).toContain('data: [DONE]')
    expect(res.ended).toBe(true)
  })

  it('assembles whole-entry RAG context, deduped by entryId, and enforces userId isolation', async () => {
    ;(searchChunks as any).mockResolvedValue([
      { entryId: 'e1', chunkIndex: 0, score: 0.9 },
      { entryId: 'e1', chunkIndex: 3, score: 0.8 }, // dup → deduped
      { entryId: 'e2', chunkIndex: 0, score: 0.7 }, // belongs to another user → skipped
    ])
    const db = journalsDbMock({
      e1: { userId: 'user-1', content: encryptField('MINE past entry', dek, 'journals.content') },
      e2: { userId: 'other', content: encryptField('NOT mine', dek, 'journals.content') },
    })
    const token = makeSession()
    const req: any = { params: { token }, body: { messages: [{ role: 'user', content: 'q' }] } }
    const res = mockSseRes()
    await llmProxyHandler(req, res, db)

    const ragArg = (PROMPTS.voiceChat as any).mock.calls[0][3]
    expect(ragArg).toContain('MINE past entry')
    expect(ragArg).not.toContain('NOT mine')       // tenant isolation
    // Deduped: entry appears exactly once even though it had two chunk hits.
    expect(ragArg.match(/MINE past entry/g)?.length).toBe(1)
  })

  it('is fail-soft: returns a completion with empty RAG when searchChunks throws', async () => {
    ;(searchChunks as any).mockRejectedValue(new Error('chroma down'))
    const token = makeSession()
    const req: any = { params: { token }, body: { messages: [{ role: 'user', content: 'q' }] } }
    const res = mockSseRes()
    await llmProxyHandler(req, res, journalsDbMock({}))

    // RAG context passed to the prompt is empty, but the completion still streams.
    expect((PROMPTS.voiceChat as any).mock.calls[0][3]).toBe('')
    expect(res.writes.join('')).toContain('data: [DONE]')
  })

  it('drops inbound system messages but keeps user/assistant history', async () => {
    const token = makeSession()
    const req: any = {
      params: { token },
      body: { messages: [
        { role: 'system', content: 'INBOUND SYSTEM' },
        { role: 'user', content: 'earlier' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'now' },
      ] },
    }
    const res = mockSseRes()
    await llmProxyHandler(req, res, journalsDbMock({}))
    const sentMessages = (chatCompletion as any).mock.calls[0][0]
    // First is our own system prompt; no inbound system leaks through.
    expect(sentMessages[0].role).toBe('system')
    expect(sentMessages.filter((m: any) => m.role === 'system')).toHaveLength(1)
    expect(sentMessages.some((m: any) => m.content === 'INBOUND SYSTEM')).toBe(false)
    expect(sentMessages.map((m: any) => m.content)).toEqual(
      expect.arrayContaining(['earlier', 'reply', 'now']),
    )
  })

  it('fails soft (graceful spoken line + DONE) on a pre-stream Morpheus error', async () => {
    ;(chatCompletion as any).mockResolvedValue(sseResponse('', 502))
    const token = makeSession()
    const req: any = { params: { token }, body: { messages: [{ role: 'user', content: 'hi' }] } }
    const res = mockSseRes()
    await llmProxyHandler(req, res, journalsDbMock({}))
    const out = res.writes.join('')
    expect(out).toContain('having a moment')
    expect(out).toContain('data: [DONE]')
  })

  it('routes the turn at the VOICE provider with a tight retry budget', async () => {
    const token = makeSession()
    const req: any = { params: { token }, body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }
    const res = mockSseRes()
    await llmProxyHandler(req, res, journalsDbMock({}))
    const opts = (chatCompletion as any).mock.calls[0][1]
    expect(opts.stream).toBe(true)
    // Voice runs on the voice provider, NOT the global reflective one.
    expect(opts.provider.name).toBe('together')
    expect(opts.provider.chatModel).toBe('meta-llama/Llama-3.3-70B-Instruct-Turbo')
    // The default aiClient budget (3 × 30s) would block a voice turn for up to
    // 90s and guarantee `custom-llm-llm-failed`; voice must bound it well under
    // Vapi's ~20s deadline. ADR-0109.
    expect(opts.retry.attempts).toBe(2)
    expect(opts.retry.timeoutMs).toBe(6_000)
    expect(opts.retry.attempts * opts.retry.timeoutMs).toBeLessThan(20_000)
  })

  it('bounds slow RAG: proceeds with empty context when the RAG step exceeds its budget', async () => {
    // searchChunks hangs forever → buildPastRagContext never settles. The budget
    // race must give up and stream the turn with NO memory context rather than let
    // a slow turn breach Vapi's custom-LLM timeout (the instant "Call ended" bug).
    ;(searchChunks as any).mockReturnValue(new Promise(() => {}))
    vi.useFakeTimers()
    try {
      const token = makeSession()
      const req: any = { params: { token }, body: { messages: [{ role: 'user', content: 'q' }] } }
      const res = mockSseRes()
      const p = llmProxyHandler(req, res, journalsDbMock({}))
      await vi.advanceTimersByTimeAsync(1600) // past RAG_BUDGET_MS (1500)
      await p
      // Empty RAG context was passed, and the completion still streamed.
      expect((PROMPTS.voiceChat as any).mock.calls[0][3]).toBe('')
      expect(res.writes.join('')).toContain('data: [DONE]')
    } finally {
      vi.useRealTimers()
    }
  })
})

import { webhookHandler as webhookHandlerForEvict } from './vapi'

describe('vapi webhook evicts the call session on end-of-call', () => {
  it('evicts the DEK-bearing session by chatId', async () => {
    _clearAllSessions()
    const token = createSession({
      uid: 'user-1', chatId: 'chat-evict', dek: Buffer.alloc(32, 1),
      name: '', bio: '', profile: {}, todayContext: '',
    } as any)
    const { db } = chatDbMock({ userId: 'user-1' })
    const req: any = {
      query: { secret: 'secret_test' }, headers: {},
      body: { message: { type: 'end-of-call-report', call: { id: 'call_1', metadata: { chatId: 'chat-evict' } } } },
    }
    const res = mockRes()
    await webhookHandlerForEvict(req, res, db)
    expect(getSessionForTest(token)).toBeUndefined()
  })
})

import { getSession as getSessionForTest } from '../services/voiceCallSessions'

// ── backchannel RAG skip + stream idle timeout (ADR-0109) ────────────────────

import { isBackchannel } from './vapi'

describe('isBackchannel', () => {
  it('treats pure filler turns as backchannel', () => {
    for (const t of ['yeah', 'Mhm.', 'ok', 'got it', 'I see', 'uh huh', 'yes!', '', '   ']) {
      expect(isBackchannel(t), t).toBe(true)
    }
  })

  it('does NOT skip short but substantive turns', () => {
    // Conservative by design: a 2-3 word real question must still get full RAG.
    for (const t of ['what about mom?', 'why though?', 'tell me more', 'my sister', 'work stress']) {
      expect(isBackchannel(t), t).toBe(false)
    }
  })

  it('never treats a long turn as backchannel', () => {
    expect(isBackchannel('yeah yeah yeah yeah')).toBe(false)
  })
})

describe('vapi /llm backchannel handling', () => {
  const dekLocal = Buffer.alloc(32, 7)
  const newSession = () => createSession({
    uid: 'user-1', chatId: 'chat-1', dek: dekLocal, name: 'Ada', bio: 'bio',
    profile: {}, todayContext: '',
  } as any)

  beforeEach(() => {
    vi.clearAllMocks()
    _clearAllSessions()
    ;(chatCompletion as any).mockResolvedValue(sseResponse('data: [DONE]\n\n'))
  })

  it('skips the RAG step entirely for a backchannel turn', async () => {
    const token = newSession()
    const req: any = { params: { token }, body: { messages: [{ role: 'user', content: 'mhm' }] } }
    await llmProxyHandler(req, mockSseRes(), journalsDbMock({}))
    // No retrieval at all — that is the whole point (no dead air on "mhm").
    expect((searchChunks as any)).not.toHaveBeenCalled()
    expect((PROMPTS.voiceChat as any).mock.calls[0][3]).toBe('')
  })

  it('still runs RAG for a substantive turn', async () => {
    const token = newSession()
    const req: any = { params: { token }, body: { messages: [{ role: 'user', content: 'how did the trip to Rome go?' }] } }
    await llmProxyHandler(req, mockSseRes(), journalsDbMock({}))
    expect((searchChunks as any)).toHaveBeenCalled()
  })
})

describe('vapi /llm stream idle timeout', () => {
  const dekIdle = Buffer.alloc(32, 9)
  const newSession = () => createSession({
    uid: 'user-1', chatId: 'chat-1', dek: dekIdle, name: 'Ada', bio: 'bio',
    profile: {}, todayContext: '',
  } as any)

  beforeEach(() => { vi.clearAllMocks(); _clearAllSessions() })

  // A body that emits `first` then STALLS forever — the failure mode a plain
  // `await reader.read()` cannot escape (the turn would hang until Vapi kills
  // the call).
  function stallingResponse(first?: string): Response {
    let sent = false
    const body = new ReadableStream({
      pull(controller) {
        if (first && !sent) { sent = true; controller.enqueue(new TextEncoder().encode(first)); return }
        return new Promise(() => {}) // never settles
      },
    })
    return new Response(body, { status: 200 })
  }

  it('cuts a stalled stream loose and still terminates the SSE response', async () => {
    ;(chatCompletion as any).mockResolvedValue(stallingResponse('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
    vi.useFakeTimers()
    try {
      const req: any = { params: { token: newSession() }, body: { messages: [{ role: 'user', content: 'mhm' }] } }
      const res = mockSseRes()
      const p = llmProxyHandler(req, res, journalsDbMock({}))
      await vi.advanceTimersByTimeAsync(8_100) // past VOICE_STREAM_IDLE_MS (8000)
      await p
      const out = res.writes.join('')
      expect(out).toContain('Hi')        // the bytes we did get were relayed
      expect(out).toContain('data: [DONE]') // and the turn was closed off
      expect(res.ended).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('speaks the graceful line when the stall happens before ANY bytes', async () => {
    ;(chatCompletion as any).mockResolvedValue(stallingResponse())
    vi.useFakeTimers()
    try {
      const req: any = { params: { token: newSession() }, body: { messages: [{ role: 'user', content: 'mhm' }] } }
      const res = mockSseRes()
      const p = llmProxyHandler(req, res, journalsDbMock({}))
      await vi.advanceTimersByTimeAsync(8_100)
      await p
      // Silence would leave the user hanging; a spoken line is recoverable.
      expect(res.writes.join('')).toContain('having a moment')
      expect(res.ended).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
