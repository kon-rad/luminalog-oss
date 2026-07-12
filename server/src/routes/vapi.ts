import { Router, Request, Response } from 'express'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { requireAiConsent } from '../middleware/requireAiConsent'
import { signedPlaybackUrl } from '../services/voiceRecordingStore'
import { PROMPTS } from '../services/prompts'
import type { ProfileFields } from '../services/profileContext'
import { config } from '../config'

export const vapiRouter = Router()

// ── call-config ──────────────────────────────────────────────────────────────

export async function callConfigHandler(req: Request, res: Response) {
  const chatId = (req.body?.chatId as string | undefined) ?? ''

  const baseUrl =
    config.NODE_ENV === 'production'
      ? 'https://api.luminalog.com'
      : `http://localhost:${config.PORT}`

  // Zero-knowledge: the client sends its RAG context as PLAINTEXT (built on-device,
  // like the text-chat path). We bake it into the assistant's system prompt here so
  // Vapi carries it into every turn — the server never decrypts mid-call.
  //
  // We override ONLY `model.messages` (no provider/model/url): Vapi merges this over
  // the assistant's dashboard-configured SOTA model, so the model + params live in the
  // Vapi dashboard while the per-call personalized system prompt still lands. Prompt
  // text stays in prompts.ts.
  const name = (req.body?.name as string | undefined) ?? ''
  const bio = (req.body?.bio as string | undefined) ?? ''
  const profile = (req.body?.profile as ProfileFields | undefined) ?? {}
  const ragContext = (req.body?.ragContext as string | undefined) ?? ''
  const focalEntry = (req.body?.focalEntry as string | undefined) || undefined
  const model = {
    messages: [
      { role: 'system', content: PROMPTS.voiceChat(name, bio, profile, ragContext, focalEntry) },
    ],
  }

  res.json({
    publicKey: config.VAPI_PUBLIC_KEY,
    assistantId: config.VAPI_ASSISTANT_ID || undefined,
    assistantOverrides: {
      // chatId lets the end-of-call webhook associate transcript + recording.
      metadata: { chatId },
      // Record the call so we can offer playback on the detail page.
      artifactPlan: { recordingEnabled: true },
      // Deliver the end-of-call report to our webhook (belt-and-suspenders with
      // the dashboard assistant config).
      server: { url: `${baseUrl}/v1/vapi/webhook`, secret: config.VAPI_WEBHOOK_SECRET },
      serverMessages: ['end-of-call-report'],
      model,
      // PlayHT/jennifer raised `playht-unknown-error` on the first message and
      // ended the call in ~0s. Vapi's native TTS needs no third-party account.
      voice: { provider: 'vapi', voiceId: 'Elliot' },
      transcriber: { provider: 'deepgram', model: 'nova-2' },
    },
  })
}

// Voice calls send name/bio/profile/RAG context to the Anthropic-powered assistant,
// so gate on AI-data-sharing consent like the other /v1/ai routes (defense in depth;
// the client ConsentGate already blocks the UI path until consent is recorded).
vapiRouter.post('/call-config', firebaseAuth, requireAiConsent, callConfigHandler)

// ── webhook (call-ended transcript + recording persistence) ───────────────────

export interface ParsedWebhook {
  type: string
  chatId: string
  callId: string
  endedReason: string
  rawTranscript: string
  recordingUrl: string
  durationSeconds: number | null
}

// Vapi wraps server messages under `message`; older/manual payloads are flat.
export function parseWebhookMessage(body: any): ParsedWebhook {
  const m = body?.message ?? body ?? {}
  const transcript =
    typeof m.transcript === 'string'
      ? m.transcript
      : typeof m.artifact?.transcript === 'string'
        ? m.artifact.transcript
        : ''

  // Prefer explicit durationSeconds field; fall back to startedAt/endedAt diff.
  let durationSeconds: number | null = null
  if (typeof m.durationSeconds === 'number' && m.durationSeconds > 0) {
    durationSeconds = m.durationSeconds
  } else if (typeof m.call?.startedAt === 'string' && typeof m.call?.endedAt === 'string') {
    const start = Date.parse(m.call.startedAt)
    const end = Date.parse(m.call.endedAt)
    if (!isNaN(start) && !isNaN(end) && end > start) {
      durationSeconds = (end - start) / 1000
    }
  }

  return {
    type: m.type ?? '',
    chatId:
      m.call?.metadata?.chatId ??
      m.call?.assistantOverrides?.metadata?.chatId ??
      m.assistant?.metadata?.chatId ??
      m.metadata?.chatId ??
      '',
    callId: m.call?.id ?? '',
    endedReason: m.endedReason ?? '',
    rawTranscript: transcript,
    // The string URL is at artifact.recordingUrl; artifact.recording is an OBJECT
    // ({ stereoUrl, mono: { combinedUrl, ... } }), so prefer the explicit strings.
    recordingUrl:
      m.recordingUrl ??
      m.artifact?.recordingUrl ??
      m.artifact?.recording?.mono?.combinedUrl ??
      m.artifact?.recording?.stereoUrl ??
      m.stereoRecordingUrl ??
      '',
    durationSeconds,
  }
}

vapiRouter.post('/webhook', async (req: Request, res: Response) => {
  // Vapi auth = a shared secret (NOT an HMAC of the body). Vapi only attaches
  // custom HTTP headers to SOME server messages — the end-of-call-report arrives
  // with none — so we accept the secret from the URL query (?secret=, always sent
  // verbatim, same trick as the /llm token), falling back to the secret headers.
  const provided = (req.query['secret']
    ?? req.headers['x-vapi-secret']
    ?? req.headers['x-vapi-signature']) as string | undefined
  if (provided !== config.VAPI_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  const parsed = parseWebhookMessage(req.body)
  console.log('[vapi/webhook]', JSON.stringify({
    type: parsed.type, endedReason: parsed.endedReason,
    chatId: parsed.chatId, callId: parsed.callId,
    hasRecording: !!parsed.recordingUrl, transcriptLen: parsed.rawTranscript.length,
  }))

  // Zero-knowledge: the client persists the voice transcript itself from the live Vapi
  // events, and the server holds no DEK to encrypt it — there is nothing to persist.
  // Acknowledge so Vapi doesn't retry. (Billing is client-side; server-side recording
  // playback is dropped for zero-knowledge accounts.)
  res.json({ ok: true })
})

// ── recording-url (authed playback url for the detail page) ───────────────────

export async function recordingUrlHandler(req: Request, res: Response, database = db) {
  const uid = (req as any).uid as string
  const chatId = (req.body?.chatId as string | undefined) ?? ''
  if (!chatId) { res.status(400).json({ error: 'chatId required' }); return }

  const snap = await database.collection('chats').doc(chatId).get()
  const data = snap.data()
  if (!data || data.userId !== uid) { res.status(403).json({ error: 'forbidden' }); return }
  if (!data.recordingPath) { res.status(404).json({ error: 'no recording' }); return }

  const url = await signedPlaybackUrl(data.recordingPath as string)
  res.json({ url })
}

vapiRouter.post('/recording-url', firebaseAuth, (req, res) => recordingUrlHandler(req, res))
