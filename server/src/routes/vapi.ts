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
import { openField, encryptField } from '../crypto/fieldCipher'

export const vapiRouter = Router()

const MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

// ── call-config ──────────────────────────────────────────────────────────────

vapiRouter.post('/call-config', firebaseAuth, async (req: Request, res: Response) => {
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
        url: `${baseUrl}/v1/vapi/llm?token=${callToken}`,
      },
      voice: { provider: 'playht', voiceId: 'jennifer' },
      transcriber: { provider: 'deepgram', model: 'nova-2' },
    },
  })
})

// ── llm (OpenAI-compatible, called by Vapi on every turn) ────────────────────

vapiRouter.post('/llm/chat/completions', async (req: Request, res: Response) => {
  const token = req.query['token'] as string | undefined
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

  const dek = await getOrCreateDEK(uid)

  const userSnap = await db.collection('users').doc(uid).get()
  const bio = openField(dek, userSnap.data()?.biography, 'users.biography')

  const journalContext = await retrieveContext(uid, lastUser, dek)

  const systemContent = PROMPTS.voiceChat(bio, journalContext)
  const augmented = [
    { role: 'system', content: systemContent },
    ...messages.filter(m => m.role !== 'system'),
  ]

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.flushHeaders()

  try {
    const aiRes = await chatCompletion(augmented, { model: MODEL, stream: true })
    if (!aiRes.ok || !aiRes.body) throw new Error(`AI error: ${aiRes.status}`)

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
    res.end()
  }
})

// ── webhook (call-ended transcript persistence) ───────────────────────────────

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

  const { type, call, artifact } = req.body as {
    type?: string
    call?: { id?: string; metadata?: { chatId?: string } }
    artifact?: { transcript?: Array<{ role: string; transcript?: string; content?: string }> }
  }

  if (type !== 'end-of-call-report' || !call) {
    res.json({ ok: true })
    return
  }

  const callId = call.id ?? ''
  const chatId = call.metadata?.chatId ?? ''
  const transcript = artifact?.transcript ?? []

  if (!chatId || transcript.length === 0) {
    res.json({ ok: true })
    return
  }

  const batch = db.batch()
  transcript.forEach((turn, i) => {
    const msgRef = db
      .collection('chats').doc(chatId)
      .collection('messages').doc(`${callId}_turn_${i}`)
    batch.set(
      msgRef,
      {
        role: turn.role,
        text: turn.transcript ?? turn.content ?? '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  })
  await batch.commit()

  await db.collection('chats').doc(chatId).update({
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  res.json({ ok: true })
})
