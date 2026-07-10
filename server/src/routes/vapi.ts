import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { retrieveContextWithSources } from '../services/journalRetriever'
import { chatCompletion } from '../services/aiClient'
import { persistVoiceTurn } from '../services/voicePersistence'
import { storeRecording, signedPlaybackUrl } from '../services/voiceRecordingStore'
import { PROMPTS } from '../services/prompts'
import { decodeProfileFields, type ProfileFields } from '../services/profileContext'
import { config, aiModel1Enabled } from '../config'
import { getOrCreateDEK } from '../crypto/keyService'
import { openFieldSafe, encryptField } from '../crypto/fieldCipher'

export const vapiRouter = Router()

const MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

async function fetchFocalEntryForVapi(uid: string, journalId: string, dek: Buffer): Promise<string | undefined> {
  try {
    const snap = await db.collection('journals').doc(journalId).get()
    const data = snap.data()
    if (!data || data.userId !== uid) return undefined
    return openFieldSafe(dek, data.content, 'journals.content') || undefined
  } catch {
    return undefined
  }
}

// ── call-config ──────────────────────────────────────────────────────────────

export async function callConfigHandler(req: Request, res: Response) {
  const uid = (req as any).uid as string
  const chatId = (req.body?.chatId as string | undefined) ?? ''
  const journalId = (req.body?.journalId as string | undefined) ?? undefined

  // ── Model 1 (zero-knowledge) branch ──────────────────────────────────────────
  // The client sends its RAG context as PLAINTEXT (built on-device, exactly like the
  // Model-1 text-chat path). We bake it into the assistant's system prompt here so
  // Vapi carries it into every /llm turn — the server then never decrypts mid-call.
  // Gated by AI_MODEL1 + presence of client context.
  const model1 = aiModel1Enabled() && typeof req.body?.ragContext === 'string'

  // chatId and journalId ride in the token so /llm has them on every turn. `model1`
  // tells /llm to stream the client-provided context verbatim (no getOrCreateDEK).
  const callToken = jwt.sign(
    { uid, chatId, journalId, model1 },
    config.VAPI_WEBHOOK_SECRET,
    { expiresIn: '2h' },
  )

  const baseUrl =
    config.NODE_ENV === 'production'
      ? 'https://api.luminalog.com'
      : `http://localhost:${config.PORT}`

  const model: Record<string, unknown> = {
    provider: 'custom-llm',
    // Vapi requires `model.model` to be a string for custom-llm providers
    // (omitting it yields "assistantOverrides.model.model must be a string").
    // Our /llm endpoint ignores it and always uses MODEL, but Vapi validates it.
    model: MODEL,
    // Vapi requests `${url}/chat/completions`. The per-call token MUST live in
    // the path (not a query string) so it survives that append — a `?token=`
    // here would put the token before `/chat/completions`, 404 the request,
    // and end the call before it connects.
    url: `${baseUrl}/v1/vapi/llm/${callToken}`,
  }

  if (model1) {
    // Build the voice system prompt from the CLIENT'S plaintext context and attach it
    // as the assistant system message. Prompt text still lives in prompts.ts.
    const name = (req.body?.name as string | undefined) ?? ''
    const bio = (req.body?.bio as string | undefined) ?? ''
    const profile = (req.body?.profile as ProfileFields | undefined) ?? {}
    const ragContext = (req.body?.ragContext as string | undefined) ?? ''
    const focalEntry = (req.body?.focalEntry as string | undefined) || undefined
    model.messages = [
      { role: 'system', content: PROMPTS.voiceChat(name, bio, profile, ragContext, focalEntry) },
    ]
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

vapiRouter.post('/call-config', firebaseAuth, callConfigHandler)

// ── llm (OpenAI-compatible, called by Vapi on every turn) ────────────────────

// Parse Together/OpenAI SSE chunks and append assistant delta text.
export function accumulateAssistantText(acc: string, chunk: string): string {
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]' || !payload) continue
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content
      if (typeof delta === 'string') acc += delta
    } catch { /* ignore keep-alive / non-JSON lines */ }
  }
  return acc
}

export async function llmHandler(req: Request, res: Response) {
  // Token rides in the path (`/llm/:token/chat/completions`) so it survives
  // Vapi appending `/chat/completions` to the configured custom-llm url.
  const token = req.params['token'] as string | undefined
  if (!token) { res.status(401).json({ error: 'Missing token' }); return }

  let uid: string
  let chatId: string
  let journalId: string | undefined
  let model1 = false
  try {
    const decoded = jwt.verify(token, config.VAPI_WEBHOOK_SECRET) as { uid: string; chatId?: string; journalId?: string; model1?: boolean }
    uid = decoded.uid
    chatId = decoded.chatId ?? ''
    journalId = decoded.journalId
    model1 = decoded.model1 === true
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const { messages } = req.body as {
    messages?: Array<{ role: string; content: string }>
  }
  if (!Array.isArray(messages)) { res.status(400).json({ error: 'Missing messages' }); return }

  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''

  // ── Model 1 (zero-knowledge) branch ──────────────────────────────────────────
  // The context already rides in the system message Vapi sends every turn (baked in
  // at /call-config from the client's on-device RAG). Stream the messages verbatim
  // to Together — NO getOrCreateDEK, NO server RAG, NO server persistence. The client
  // persists the transcript locally from the live Vapi events.
  if (model1) {
    try {
      const aiRes = await chatCompletion(messages, { model: MODEL, stream: true })
      if (!aiRes.ok || !aiRes.body) throw new Error(`AI error: ${aiRes.status}`)
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.flushHeaders()
      let buffer = ''
      const decoder = new TextDecoder()
      const reader = (aiRes.body as any).getReader()
      const flush = (raw: string) => {
        const line = raw.trimEnd()
        if (!line.startsWith('data: ')) return
        if (line.slice(6).trim() === '[DONE]') return
        res.write(line + '\n\n')
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value as Uint8Array, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) flush(line)
      }
      if (buffer) flush(buffer)
      res.write('data: [DONE]\n\n')
      res.end()
    } catch (err) {
      console.error('[vapi/llm model1]', err)
      if (!res.headersSent) res.status(500).json({ error: 'LLM error' })
      else res.end()
    }
    return
  }
  // A valid call always carries a zero-knowledge token (set at /call-config); reject
  // anything else rather than hang the turn.
  res.status(400).json({ error: 'Invalid call token' })
}

vapiRouter.post('/llm/:token/chat/completions', llmHandler)

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

  if (parsed.type !== 'end-of-call-report') { res.json({ ok: true }); return }
  const { chatId, callId, endedReason, rawTranscript, durationSeconds } = parsed
  if (!chatId) { res.json({ ok: true }); return }

  // Resolve the chat owner so transcript text is encrypted with their DEK,
  // matching how chat.ts reads message text (openField throws on plaintext).
  const chatSnap = await db.collection('chats').doc(chatId).get()
  const ownerUid = chatSnap.data()?.userId as string | undefined
  if (!ownerUid) { res.json({ ok: true }); return }
  // Zero-knowledge account: the server holds no DEK, so it can't encrypt/persist the
  // transcript — the client already persisted it locally from the live Vapi events.
  // Skip cleanly (also fixes the previously-unhandled throw for migrated users).
  let dek: Buffer
  try {
    dek = await getOrCreateDEK(ownerUid)
  } catch (err) {
    console.log('[vapi/webhook] ZK account — skipping server persistence', { chatId })
    res.json({ ok: true })
    return
  }

  const update: Record<string, unknown> = {
    voiceStatus: 'completed',
    endedReason,
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (callId) update.vapiCallId = callId
  if (rawTranscript) update.rawTranscript = encryptField(dek, rawTranscript, 'chats.rawTranscript')
  if (durationSeconds !== null) update.recordingDurationSeconds = durationSeconds
  await db.collection('chats').doc(chatId).update(update)

  if (parsed.recordingUrl && callId) {
    try {
      const key = await storeRecording(ownerUid, callId, parsed.recordingUrl)
      await db.collection('chats').doc(chatId).update({ recordingPath: key })
    } catch (rerr) {
      console.error('[vapi/webhook recording]', rerr)
      await db.collection('chats').doc(chatId).update({ recordingError: true })
    }
  }

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
