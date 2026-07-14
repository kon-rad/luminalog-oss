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
vi.mock('../services/prompts', () => ({ PROMPTS: { voiceChat: vi.fn(() => 'VOICE_SYSTEM_PROMPT') } }))
vi.mock('../services/voiceRecordingStore', () => ({
  stageRecording: vi.fn(),
  deleteStaging: vi.fn(),
  stagingKey: (uid: string, callId: string) => `users/${uid}/voice-staging/${callId}.wav`,
  finalRecordingKey: (uid: string, callId: string) => `users/${uid}/voice/${callId}.wav`,
}))

import { callConfigHandler } from './vapi'
import { config } from '../config'
import { PROMPTS } from '../services/prompts'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
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
import { stageRecording } from '../services/voiceRecordingStore'

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
})
