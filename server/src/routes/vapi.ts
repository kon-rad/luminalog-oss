import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { requireAiConsent } from '../middleware/requireAiConsent'
import { stageRecording, deleteStaging } from '../services/voiceRecordingStore'
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
  // We inject the per-call personalized prompt via a Vapi TEMPLATE VARIABLE, not a
  // `model` override. The dashboard assistant's system prompt is literally
  // `{{systemPrompt}}`; Vapi substitutes this value at call time. Model + provider +
  // params live entirely on the dashboard (ADR-0077). We must NOT send `model` here:
  // Vapi validates any `assistantOverrides.model` as a COMPLETE model object and rejects
  // the call with `model.provider must be one of…` (a 400 "Call failed") if provider is
  // absent — it does not deep-merge a bare `messages` override. Prompt text stays in
  // prompts.ts.
  const name = (req.body?.name as string | undefined) ?? ''
  const bio = (req.body?.bio as string | undefined) ?? ''
  const profile = (req.body?.profile as ProfileFields | undefined) ?? {}
  const ragContext = (req.body?.ragContext as string | undefined) ?? ''
  const focalEntry = (req.body?.focalEntry as string | undefined) || undefined
  // Today's entries, fetched client-side straight from the local DB (not RAG) so they are
  // always complete and current.
  const todayContext = (req.body?.todayContext as string | undefined) ?? ''
  // Device-local wall clock at call start; anchors the assistant's "today"/"now" against
  // the local timestamps the client stamped onto each entry block.
  const currentDateTime = (req.body?.now as string | undefined) || undefined
  const systemPrompt = PROMPTS.voiceChat(name, bio, profile, ragContext, focalEntry, currentDateTime, todayContext)

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
      // Substituted into the dashboard prompt's `{{systemPrompt}}` placeholder.
      variableValues: { systemPrompt },
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

export async function webhookHandler(req: Request, res: Response, database = db): Promise<void> {
  // Vapi auth = a shared secret (NOT an HMAC of the body). The end-of-call-report
  // arrives with no custom headers, so accept ?secret= (always sent verbatim),
  // falling back to the secret headers.
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

  // Zero-knowledge: the client persists the voice TRANSCRIPT itself from live events.
  // For the recording, the server can't encrypt (no DEK), so it only STAGES the
  // plaintext audio promptly (Vapi retains it ~14 days) and records a pointer; the
  // client encrypts + finalizes on next foreground. Best-effort — always ack so Vapi
  // does not retry.
  if (parsed.recordingUrl && parsed.chatId && parsed.callId) {
    try {
      const snap = await database.collection('chats').doc(parsed.chatId).get()
      const uid = snap.data()?.userId as string | undefined
      if (!uid) {
        console.error('[vapi/webhook] no chat/uid for recording', { chatId: parsed.chatId })
      } else {
        const key = await stageRecording(uid, parsed.callId, parsed.recordingUrl)
        if (key) {
          const update: Record<string, unknown> = { pendingRecordingKey: key }
          if (parsed.durationSeconds != null) update.recordingDurationSeconds = parsed.durationSeconds
          await database.collection('chats').doc(parsed.chatId).update(update)
        }
      }
    } catch (err) {
      console.error('[vapi/webhook] recording stage failed', err)
    }
  }

  res.json({ ok: true })
}

vapiRouter.post('/webhook', (req: Request, res: Response) => webhookHandler(req, res))

// ── recording-finalize (client re-uploaded the encrypted recording) ───────────

export async function recordingFinalizeHandler(req: Request, res: Response, database = db): Promise<void> {
  const uid = (req as any).uid as string
  const chatId = (req.body?.chatId as string | undefined) ?? ''
  const recordingPath = (req.body?.recordingPath as string | undefined) ?? ''
  if (!chatId || !recordingPath) { res.status(400).json({ error: 'chatId and recordingPath required' }); return }
  // The client may only point recordingPath at its own namespace.
  if (!recordingPath.startsWith(`users/${uid}/`)) { res.status(403).json({ error: 'forbidden' }); return }

  const ref = database.collection('chats').doc(chatId)
  const snap = await ref.get()
  const data = snap.data()
  if (!data || data.userId !== uid) { res.status(403).json({ error: 'forbidden' }); return }

  const stagingPath = data.pendingRecordingKey as string | undefined
  await ref.update({
    recordingPath,
    pendingRecordingKey: admin.firestore.FieldValue.delete(),
  })
  if (stagingPath) {
    try { await deleteStaging(stagingPath) } catch (err) { console.error('[vapi/recording-finalize] staging delete failed', err) }
  }
  res.json({ ok: true })
}

vapiRouter.post('/recording-finalize', firebaseAuth, (req: Request, res: Response) => recordingFinalizeHandler(req, res))
