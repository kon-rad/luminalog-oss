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

    // ── Model 1 (zero-knowledge) branch ──────────────────────────────────────
    // The client sends every piece of context as PLAINTEXT: bio, profile, the
    // chat history, the client-side RAG `journalContext`, and any focal entry.
    // We build the prompt directly and NEVER call getOrCreateDEK/openField.
    // Because there is no DEK on this path, message persistence is deferred to
    // the client (which re-encrypts and stores in increment 1c-C) — the server
    // does NOT write the user/assistant messages here. Gated by AI_MODEL1 (off in
    // production). The legacy server-decrypt fallback below is removed at the 1d
    // cutover. Trigger: flag on AND the body carries a `history` array (legacy
    // clients never send one — the server builds history from Firestore).
    const model1 = aiModel1Enabled() && Array.isArray(body.history)

    let name: string, bio: string, profile: ProfileFields
    let history: Array<{ role: string; content: string }>
    let journalContext: string
    let focalEntry: string | undefined
    let dek: Buffer | undefined
    let chatRef: any

    if (model1) {
      name = body.name ?? ''
      bio = body.bio ?? ''
      profile = body.profile ?? {}
      history = (body.history ?? []).map(m => ({
        role: String(m.role ?? 'user'),
        content: String(m.content ?? ''),
      }))
      journalContext = body.journalContext ?? ''
      focalEntry = body.focalEntry || undefined
    } else {
      // ── Legacy path (UNCHANGED — server decrypts everything with the DEK).
      dek = await getOrCreateDEK(uid)

      const userSnap = await db.collection('users').doc(uid).get()
      // Biography is optional context — legacy/plaintext data must not abort chat.
      bio = openFieldSafe(dek, userSnap.data()?.biography, 'users.biography')
      // Display name is stored plaintext (only biography is field-encrypted).
      name = (userSnap.data()?.displayName as string | undefined) ?? ''
      // Extended onboarding profile fields (all optional, field-encrypted).
      profile = decodeProfileFields(dek, userSnap.data())

      const [msgsSnap, chatSnap] = await Promise.all([
        db.collection('chats').doc(chatId).collection('messages')
          .orderBy('createdAt', 'desc').limit(10).get(),
        db.collection('chats').doc(chatId).get(),
      ])
      history = msgsSnap.docs.reverse().map(d => ({
        role: d.data().role as string,
        content: openFieldSafe(dek!, d.data().text, 'messages.text'),
      }))

      const assistantContext = history
        .filter(m => m.role === 'assistant')
        .slice(-2)
        .map(m => m.content)
        .join(' ')
      const ragQuery = `${message} ${assistantContext}`.slice(-2000)

      // Resolve journalId: prefer the value from the request body (legacy clients
      // that send it), then fall back to the journalId stored on the chat document
      // (set at chat creation time when launched from a journal entry detail page).
      const resolvedJournalId = journalId || (chatSnap.data()?.journalId as string | undefined)

      journalContext = await retrieveContext(uid, ragQuery, dek)
      focalEntry = resolvedJournalId ? await fetchFocalEntry(uid, resolvedJournalId, dek) : undefined
    }

    const systemPrompt = PROMPTS.chatSystem(name, bio, profile, journalContext, focalEntry)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ]

    // User-message persistence runs ONLY on the legacy path (Model 1 has no DEK;
    // the client persists + re-encrypts in 1c-C).
    if (!model1 && dek) {
      chatRef = db.collection('chats').doc(chatId)
      // A client-supplied `messageId` makes the user-message write idempotent: a
      // retry after a mid-stream failure re-`set`s the SAME doc instead of
      // creating a duplicate. Legacy clients (iOS) omit it → auto-id, unchanged.
      const userMsgRef = messageId
        ? chatRef.collection('messages').doc(messageId)
        : chatRef.collection('messages').doc()
      await userMsgRef.set({
        role: 'user',
        text: encryptField(dek, message, 'messages.text'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

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

    // Assistant-reply persistence runs ONLY on the legacy path (Model 1 has no
    // DEK; the client persists + re-encrypts the reply in 1c-C).
    if (!model1 && dek && chatRef) {
      const assistantMsgRef = chatRef.collection('messages').doc()
      await assistantMsgRef.set({
        role: 'assistant',
        text: encryptField(dek, fullReply, 'messages.text'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      await chatRef.update({ lastMessageAt: admin.firestore.FieldValue.serverTimestamp() })
    }

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
