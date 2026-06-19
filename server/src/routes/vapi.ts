import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { retrieveContextWithSources } from '../services/journalRetriever'
import { chatCompletion } from '../services/aiClient'
import { persistVoiceTurn } from '../services/voicePersistence'
import { storeRecording, signedPlaybackUrl } from '../services/voiceRecordingStore'
import { PROMPTS } from '../services/prompts'
import { config } from '../config'
import { getOrCreateDEK } from '../crypto/keyService'
import { openFieldSafe, encryptField } from '../crypto/fieldCipher'

export const vapiRouter = Router()

const MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

// ── call-config ──────────────────────────────────────────────────────────────

export async function callConfigHandler(req: Request, res: Response) {
  const uid = (req as any).uid as string
  const chatId = (req.body?.chatId as string | undefined) ?? ''

  // chatId rides in the token so /llm persists each turn without a DB lookup.
  const callToken = jwt.sign({ uid, chatId }, config.VAPI_WEBHOOK_SECRET, { expiresIn: '2h' })

  const baseUrl =
    config.NODE_ENV === 'production'
      ? 'https://api.luminalog.com'
      : `http://localhost:${config.PORT}`

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
      model: {
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
      },
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
  try {
    const decoded = jwt.verify(token, config.VAPI_WEBHOOK_SECRET) as { uid: string; chatId?: string }
    uid = decoded.uid
    chatId = decoded.chatId ?? ''
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const { messages } = req.body as {
    messages?: Array<{ role: string; content: string }>
  }
  if (!Array.isArray(messages)) { res.status(400).json({ error: 'Missing messages' }); return }

  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''

  // Guard the whole turn — an unguarded throw here (e.g. legacy biography data)
  // sends Vapi no response and crashes the process under Node's default.
  try {
    const dek = await getOrCreateDEK(uid)

    const userSnap = await db.collection('users').doc(uid).get()
    // Biography is optional context — legacy/plaintext data must not abort the call.
    const bio = openFieldSafe(dek, userSnap.data()?.biography, 'users.biography')
    // Display name is stored plaintext (only biography is field-encrypted).
    const name = (userSnap.data()?.displayName as string | undefined) ?? ''

    const rag = await retrieveContextWithSources(uid, lastUser, dek)

    const systemContent = PROMPTS.voiceChat(name, bio, rag.contextString)
    const augmented = [
      { role: 'system', content: systemContent },
      ...messages.filter(m => m.role !== 'system'),
    ]

    const aiRes = await chatCompletion(augmented, { model: MODEL, stream: true })
    if (!aiRes.ok || !aiRes.body) throw new Error(`AI error: ${aiRes.status}`)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.flushHeaders()

    // Turn index = number of user messages so far → stable, idempotent doc ids.
    const turnIndex = messages.filter(m => m.role === 'user').length
    let assistantText = ''
    let buffer = ''
    const decoder = new TextDecoder()
    const reader = (aiRes.body as any).getReader()

    // Forward only COMPLETE SSE `data:` lines. The trailing partial line must be
    // buffered across reads — a line split mid-JSON otherwise reaches Vapi
    // malformed, which it silently drops, so the reply is generated/persisted but
    // never spoken and the call ends on silence.
    const flush = (raw: string) => {
      const line = raw.trimEnd() // tolerate CRLF
      if (!line.startsWith('data: ')) return
      if (line.slice(6).trim() === '[DONE]') return // we emit our own terminator
      res.write(line + '\n\n')
      assistantText = accumulateAssistantText(assistantText, line + '\n')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value as Uint8Array, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // keep the (possibly partial) last line
      for (const line of lines) flush(line)
    }
    if (buffer) flush(buffer)
    res.write('data: [DONE]\n\n')
    res.end()

    // Persist AFTER responding — never block or break the voice stream.
    if (chatId) {
      try {
        await persistVoiceTurn(db, dek, { chatId, turnIndex, userText: lastUser, assistantText, sources: rag.sources })
      } catch (perr) {
        console.error('[vapi/llm persist]', perr)
      }
    }
  } catch (err) {
    console.error('[vapi/llm]', err)
    if (res.headersSent) res.end()
    else res.status(500).json({ error: 'LLM turn failed' })
  }
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
    recordingUrl: m.recordingUrl ?? m.artifact?.recording ?? m.stereoRecordingUrl ?? '',
  }
}

vapiRouter.post('/webhook', async (req: Request, res: Response) => {
  // Vapi authenticates webhooks with a shared secret header (x-vapi-secret, or
  // x-vapi-signature when set as a custom header) — NOT an HMAC of the body. The
  // previous HMAC comparison rejected every delivery with 401.
  const provided = (req.headers['x-vapi-secret'] ?? req.headers['x-vapi-signature']) as string | undefined
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
  const { chatId, callId, endedReason, rawTranscript } = parsed
  if (!chatId) { res.json({ ok: true }); return }

  // Resolve the chat owner so transcript text is encrypted with their DEK,
  // matching how chat.ts reads message text (openField throws on plaintext).
  const chatSnap = await db.collection('chats').doc(chatId).get()
  const ownerUid = chatSnap.data()?.userId as string | undefined
  if (!ownerUid) { res.json({ ok: true }); return }
  const dek = await getOrCreateDEK(ownerUid)

  const update: Record<string, unknown> = {
    voiceStatus: 'completed',
    endedReason,
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (callId) update.vapiCallId = callId
  if (rawTranscript) update.rawTranscript = encryptField(dek, rawTranscript, 'chats.rawTranscript')
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
