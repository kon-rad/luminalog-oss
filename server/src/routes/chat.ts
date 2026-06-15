import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { retrieveContext } from '../services/journalRetriever'
import { chatCompletion } from '../services/aiClient'
import { PROMPTS } from '../services/prompts'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, encryptField } from '../crypto/fieldCipher'

export const chatRouter = Router()

chatRouter.post('/', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { chatId, message } = req.body as { chatId?: string; message?: string }

  if (!chatId || !message) {
    res.status(400).json({ error: 'Missing chatId or message' })
    return
  }

  const dek = await getOrCreateDEK(uid)

  const userSnap = await db.collection('users').doc(uid).get()
  const bio = openField(dek, userSnap.data()?.biography, 'users.biography')

  const msgsSnap = await db
    .collection('chats').doc(chatId).collection('messages')
    .orderBy('createdAt', 'desc').limit(10).get()
  const history = msgsSnap.docs.reverse().map(d => ({
    role: d.data().role as string,
    content: openField(dek, d.data().text, 'messages.text'),
  }))

  const assistantContext = history
    .filter(m => m.role === 'assistant')
    .slice(-2)
    .map(m => m.content)
    .join(' ')
  const ragQuery = `${message} ${assistantContext}`.slice(-2000)

  const journalContext = await retrieveContext(uid, ragQuery, dek)

  const systemPrompt = PROMPTS.chatSystem(bio, journalContext)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ]

  const chatRef = db.collection('chats').doc(chatId)
  const userMsgRef = chatRef.collection('messages').doc()
  await userMsgRef.set({
    role: 'user',
    text: encryptField(dek, message, 'messages.text'),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const aiRes = await chatCompletion(messages, { stream: true })
    if (!aiRes.ok || !aiRes.body) {
      throw new Error(`Together AI error: ${aiRes.status}`)
    }

    let fullReply = ''
    const decoder = new TextDecoder()
    const reader = (aiRes.body as any).getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value as Uint8Array)
      for (const line of text.split('\n')) {
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

    const assistantMsgRef = chatRef.collection('messages').doc()
    await assistantMsgRef.set({
      role: 'assistant',
      text: encryptField(dek, fullReply, 'messages.text'),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    await chatRef.update({ lastMessageAt: admin.firestore.FieldValue.serverTimestamp() })

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[chat]', err)
    res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
    res.end()
  }
})
