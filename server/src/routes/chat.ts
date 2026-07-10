import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { retrieveContext } from '../services/journalRetriever'
import { chatCompletion } from '../services/aiClient'
import { PROMPTS } from '../services/prompts'
import { decodeProfileFields, type ProfileFields } from '../services/profileContext'
import { getOrCreateDEK } from '../crypto/keyService'
import { openFieldSafe, encryptField } from '../crypto/fieldCipher'
import { aiModel1Enabled } from '../config'

export const chatRouter = Router()

async function fetchFocalEntry(uid: string, journalId: string, dek: Buffer): Promise<string | undefined> {
  try {
    const snap = await db.collection('journals').doc(journalId).get()
    const data = snap.data()
    if (!data || data.userId !== uid) return undefined
    return openFieldSafe(dek, data.content, 'journals.content') || undefined
  } catch {
    return undefined
  }
}

export async function chatHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const { chatId, message, journalId, messageId } = req.body as { chatId?: string; message?: string; journalId?: string; messageId?: string }

  if (!chatId || !message) {
    res.status(400).json({ error: 'Missing chatId or message' })
    return
  }

  // The ENTIRE handler is guarded: Express 4 does not forward async-handler
  // rejections, so an unguarded throw before the response begins sends NOTHING
  // (the client hangs to its own timeout) and crashes the process under Node's
  // default unhandledRejection behaviour. Always send a terminal response.
  try {
    const body = req.body as {
      bio?: string; name?: string; profile?: ProfileFields
      history?: Array<{ role?: string; content?: string }>
      journalContext?: string; focalEntry?: string
    }

    // Zero-knowledge: the client sends every piece of context as PLAINTEXT (bio,
    // profile, chat history, the client-side RAG `journalContext`, and any focal
    // entry). The server NEVER decrypts — it builds the prompt and streams the reply;
    // the client persists + re-encrypts the messages itself.
    if (!Array.isArray(body.history)) {
      res.status(400).json({ error: 'Missing client context (history)' })
      return
    }
    const name = body.name ?? ''
    const bio = body.bio ?? ''
    const profile: ProfileFields = body.profile ?? {}
    const history = body.history.map(m => ({
      role: String(m.role ?? 'user'),
      content: String(m.content ?? ''),
    }))
    const journalContext = body.journalContext ?? ''
    const focalEntry = body.focalEntry || undefined

    const systemPrompt = PROMPTS.chatSystem(name, bio, profile, journalContext, focalEntry)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ]

    const aiRes = await chatCompletion(messages, { stream: true })
    if (!aiRes.ok || !aiRes.body) {
      throw new Error(`Together AI error: ${aiRes.status}`)
    }

    // Headers flushed only once we know the upstream stream is good, so any
    // failure above is still reportable as a JSON error (see catch).
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    let fullReply = ''
    // SSE lines can be split across read() chunks, so we buffer incomplete lines
    // and only process them once a full newline-terminated line arrives.
    const decoder = new TextDecoder()
    const reader = (aiRes.body as any).getReader()
    let lineBuffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      lineBuffer += decoder.decode(value as Uint8Array, { stream: true })
      const lines = lineBuffer.split('\n')
      // Keep the last element: it may be an incomplete line awaiting more data.
      lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') continue
        try {
          const parsed = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> }
          const delta = parsed.choices?.[0]?.delta?.content ?? ''
          if (delta) {
            fullReply += delta
            res.write(`data: ${JSON.stringify({ delta })}\n\n`)
          }
        } catch {}
      }
    }

    // The client persists + re-encrypts both the user message and this reply itself
    // (zero-knowledge: the server holds no DEK), so nothing is written here.
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[chat]', err)
    // If streaming already started, surface the error in-band; otherwise the
    // headers are still open, so reply with a normal JSON 500.
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ error: 'Chat failed' })
    }
  }
}

chatRouter.post('/', firebaseAuth, chatHandler)
