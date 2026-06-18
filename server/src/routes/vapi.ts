import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { retrieveContext } from '../services/journalRetriever'
import { chatCompletion } from '../services/aiClient'
import { PROMPTS } from '../services/prompts'
import { config } from '../config'
import { getOrCreateDEK } from '../crypto/keyService'
import { openFieldSafe, encryptField } from '../crypto/fieldCipher'

export const vapiRouter = Router()

const MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

// ── call-config ──────────────────────────────────────────────────────────────

export async function callConfigHandler(req: Request, res: Response) {
  const uid = (req as any).uid as string

  const callToken = jwt.sign({ uid }, config.VAPI_WEBHOOK_SECRET, { expiresIn: '2h' })

  const baseUrl =
    config.NODE_ENV === 'production'
      ? 'https://api.luminalog.com'
      : `http://localhost:${config.PORT}`

  res.json({
    publicKey: config.VAPI_PUBLIC_KEY,
    assistantId: config.VAPI_ASSISTANT_ID || undefined,
    assistantOverrides: {
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
      voice: { provider: 'playht', voiceId: 'jennifer' },
      transcriber: { provider: 'deepgram', model: 'nova-2' },
    },
  })
}

vapiRouter.post('/call-config', firebaseAuth, callConfigHandler)

// ── llm (OpenAI-compatible, called by Vapi on every turn) ────────────────────

export async function llmHandler(req: Request, res: Response) {
  // Token rides in the path (`/llm/:token/chat/completions`) so it survives
  // Vapi appending `/chat/completions` to the configured custom-llm url.
  const token = req.params['token'] as string | undefined
  if (!token) { res.status(401).json({ error: 'Missing token' }); return }

  let uid: string
  try {
    const decoded = jwt.verify(token, config.VAPI_WEBHOOK_SECRET) as { uid: string }
    uid = decoded.uid
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

    const journalContext = await retrieveContext(uid, lastUser, dek)

    const systemContent = PROMPTS.voiceChat(name, bio, journalContext)
    const augmented = [
      { role: 'system', content: systemContent },
      ...messages.filter(m => m.role !== 'system'),
    ]

    const aiRes = await chatCompletion(augmented, { model: MODEL, stream: true })
    if (!aiRes.ok || !aiRes.body) throw new Error(`AI error: ${aiRes.status}`)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.flushHeaders()

    const decoder = new TextDecoder()
    const reader = (aiRes.body as any).getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value as Uint8Array)
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) res.write(line + '\n\n')
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
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
    chatId: m.call?.metadata?.chatId ?? m.metadata?.chatId ?? '',
    callId: m.call?.id ?? '',
    endedReason: m.endedReason ?? '',
    rawTranscript: transcript,
    recordingUrl: m.recordingUrl ?? m.artifact?.recording ?? m.stereoRecordingUrl ?? '',
  }
}

vapiRouter.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-vapi-signature'] as string | undefined
  if (signature) {
    const expected = crypto
      .createHmac('sha256', config.VAPI_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex')
    if (signature !== expected) {
      res.status(401).json({ error: 'Invalid signature' })
      return
    }
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

  // Recording download → S3 is added in a later step (voiceRecordingStore).

  res.json({ ok: true })
})
