import express, { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { transcribeClipHandler } from './transcribeClip'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { chatCompletion, transcribeAudio, streamToBuffer } from '../services/aiClient'
import { indexJournalEntry } from '../services/journalIndexer'
import { PROMPTS } from '../services/prompts'
import { generateSummaryText } from '../services/summaryGenerator'
import { config } from '../config'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, encryptField } from '../crypto/fieldCipher'
import { decryptMedia } from '../crypto/mediaCipher'

export const aiRouter = Router()

// Raw audio body (no multipart): app-level express.json ignores audio/* content
// types, so this per-route parser owns the body.
aiRouter.post(
  '/transcribe-clip',
  firebaseAuth,
  express.raw({ type: 'audio/*', limit: '25mb' }),
  transcribeClipHandler,
)

const MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
})

async function generate(systemPrompt: string, userContent: string): Promise<string> {
  const res = await chatCompletion(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
    { model: MODEL },
  )
  if (!res.ok) throw new Error(`Together AI error: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content.trim()
}

async function fetchJournal(journalId: string, uid: string): Promise<Record<string, any>> {
  const snap = await db.collection('journals').doc(journalId).get()
  if (!snap.exists) throw Object.assign(new Error('Not found'), { status: 404 })
  const data = snap.data()! as Record<string, any>
  if (data.userId !== uid) throw Object.assign(new Error('Forbidden'), { status: 403 })
  const dek = await getOrCreateDEK(uid)
  return {
    ...data,
    content: openField(dek, data.content, 'journals.content'),
    title: openField(dek, data.title, 'journals.title'),
  }
}

async function fetchUserSummaryConfig(uid: string) {
  const snap = await db.collection('users').doc(uid).get()
  const data = snap.exists ? snap.data() : undefined
  return data?.summaryConfig as { wordLength?: number; systemPrompt?: string } | undefined
}

aiRouter.post('/summary', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { journalId } = req.body as { journalId?: string }
  if (!journalId) { res.status(400).json({ error: 'Missing journalId' }); return }

  try {
    const data = await fetchJournal(journalId, uid)
    const userConfig = await fetchUserSummaryConfig(uid)
    const out = await generateSummaryText({
      type: data.type ?? 'text',
      content: data.content ?? '',
      userConfig,
    })
    res.json({ text: out.text, model: out.model, generatedAt: out.generatedAt })
  } catch (err: any) {
    console.error('[ai/summary]', err)
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

aiRouter.post('/insights', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { journalId } = req.body as { journalId?: string }
  if (!journalId) { res.status(400).json({ error: 'Missing journalId' }); return }

  try {
    const data = await fetchJournal(journalId, uid)
    const text = await generate(PROMPTS.insights(), data.content ?? '')
    const now = new Date().toISOString()
    res.json({ text, model: MODEL, generatedAt: now })
  } catch (err: any) {
    console.error('[ai/insights]', err)
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

aiRouter.post('/prompts', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { journalId } = req.body as { journalId?: string }
  if (!journalId) { res.status(400).json({ error: 'Missing journalId' }); return }

  try {
    const data = await fetchJournal(journalId, uid)
    const text = await generate(PROMPTS.prompts(), data.content ?? '')
    const items = text
      .split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
      .filter(l => l.endsWith('?'))
      .slice(0, 5)
    res.json({ items, model: MODEL })
  } catch (err: any) {
    console.error('[ai/prompts]', err)
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

aiRouter.post('/daily-prompt', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string

  try {
    const snap = await db.collection('journals')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
    const dek = await getOrCreateDEK(uid)
    const context = snap.docs
      .map(d => {
        const data = d.data()
        const title = openField(dek, data.title, 'journals.title') || 'Untitled'
        const content = openField(dek, data.content, 'journals.content')
        return `[${data.type ?? 'text'} · ${title}]\n${content.slice(0, 500)}`
      })
      .join('\n\n---\n\n')
    const text = await generate(PROMPTS.dailyPrompt(), context || 'No entries yet.')
    res.json({ text })
  } catch (err: any) {
    console.error('[ai/daily-prompt]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── server-side audio/video transcription via Together AI Whisper ─────────────
// Called after save when on-device Apple Speech fails (transcriptStatus=failed).
// Downloads the audio/video file from S3, sends to Together AI, updates
// Firestore content+transcriptStatus, then re-indexes to Chroma.

aiRouter.post('/transcribe', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { journalId } = req.body as { journalId?: string }
  if (!journalId) { res.status(400).json({ error: 'Missing journalId' }); return }

  const docSnap = await db.collection('journals').doc(journalId).get()
  if (!docSnap.exists) { res.status(404).json({ error: 'Journal not found' }); return }
  const data = docSnap.data()!
  if (data.userId !== uid) { res.status(403).json({ error: 'Forbidden' }); return }

  type MediaItem = { s3Key: string; kind: string }
  const media: MediaItem[] = data.media ?? []
  const audioItem = media.find(m => m.kind === 'audio' || m.kind === 'video')
  if (!audioItem) {
    res.status(400).json({ error: 'No audio or video media found on this entry' })
    return
  }

  try {
    const dek = await getOrCreateDEK(uid)

    const s3Res = await s3.send(
      new GetObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: audioItem.s3Key }),
    )
    if (!s3Res.Body) throw new Error('S3 returned empty body')
    const audioBuffer = decryptMedia(dek, await streamToBuffer(s3Res.Body as any))

    const filename = audioItem.s3Key.split('/').pop() ?? 'audio.m4a'
    const transcript = await transcribeAudio(audioBuffer, filename)

    // Prepend any previously typed text that was saved with the entry.
    const existingContent = openField(dek, data.content, 'journals.content').trim()
    const newContent = [existingContent, transcript]
      .filter(Boolean)
      .join('\n\n')

    await db.collection('journals').doc(journalId).update({
      content: encryptField(dek, newContent, 'journals.content'),
      transcriptStatus: 'ready',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    const indexResult = await indexJournalEntry({
      userId: uid,
      entryId: journalId,
      content: newContent,
      title: openField(dek, data.title, 'journals.title'),
      type: data.type ?? 'voice',
      updatedAt: new Date().toISOString(),
      dek,
    })

    await db.collection('journals').doc(journalId).update({
      vector: {
        status: 'indexed',
        chunkCount: indexResult.chunks,
        indexedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    })

    res.json({ transcribed: true, chunks: indexResult.chunks })
  } catch (err) {
    console.error('[ai/transcribe]', err)
    await db.collection('journals').doc(journalId)
      .update({ transcriptStatus: 'failed' })
      .catch(() => {})
    res.status(500).json({ error: 'Transcription failed' })
  }
})
