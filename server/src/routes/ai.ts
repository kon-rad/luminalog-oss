import express, { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { transcribeClipHandler } from './transcribeClip'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { chatCompletion, transcribeAudio, streamToBuffer } from '../services/aiClient'
import { indexJournalEntry } from '../services/journalIndexer'
import { extractAudio } from '../services/audioExtractor'
import { PROMPTS } from '../services/prompts'
import { generateSummaryText } from '../services/summaryGenerator'
import { ensureEntrySummaryIndexed } from '../services/summaryService'
import { invalidateGraph } from '../services/graphBuilder'
import { config } from '../config'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, encryptField } from '../crypto/fieldCipher'
import { decryptMedia } from '../crypto/mediaCipher'
import { nextStats, type GoalStats } from '../services/dailyGoalStreak'
import { scoreEntryEmotion } from '../services/entryEmotion'

export const aiRouter = Router()

/** Canonical word count — matches the iOS `WordCount.of` (whitespace split). */
function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length
}

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

export async function transcribeHandler(req: Request, res: Response): Promise<void> {
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
    const mediaBuffer = decryptMedia(dek, await streamToBuffer(s3Res.Body as any))

    // Videos are far larger than their audio and can exceed the transcription
    // endpoint's upload cap, so strip the video stream first. Audio entries are
    // already compact and sent as-is.
    let audioBuffer = mediaBuffer
    let filename = audioItem.s3Key.split('/').pop() ?? 'audio.m4a'
    if (audioItem.kind === 'video') {
      audioBuffer = await extractAudio(mediaBuffer)
      filename = 'audio.m4a'
    }
    const transcript = await transcribeAudio(audioBuffer, filename)

    // Prepend any previously typed text that was saved with the entry.
    const existingContent = openField(dek, data.content, 'journals.content').trim()
    const newContent = [existingContent, transcript]
      .filter(Boolean)
      .join('\n\n')

    // Recompute the word count from the finished transcript and credit the
    // delta (vs. the count saved at creation) to the daily goal — atomically,
    // so it is retry-safe and never double-counts regardless of client state.
    const journalRef = db.collection('journals').doc(journalId)
    const userRef = db.collection('users').doc(uid)
    const newWordCount = countWords(newContent)

    await db.runTransaction(async (tx) => {
      // Reads first (Firestore transaction rule).
      const [journalDoc, userDoc] = await Promise.all([
        tx.get(journalRef),
        tx.get(userRef),
      ])
      const jData = journalDoc.data() ?? {}
      const uData = userDoc.data() ?? {}

      const oldWordCount = (jData.wordCount as number) ?? 0
      const delta = newWordCount - oldWordCount

      const createdAt =
        (jData.createdAt as admin.firestore.Timestamp | undefined)?.toDate() ?? new Date()
      const timeZone = (uData.timezone as string) || 'UTC'

      const s = (uData.stats as Record<string, unknown>) ?? {}
      const current: GoalStats = {
        streakCount: (s.streakCount as number) ?? 0,
        lastEntryDate:
          (s.lastEntryDate as admin.firestore.Timestamp | undefined)?.toDate() ?? null,
        totalWords: (s.totalWords as number) ?? 0,
        goalDayDate:
          (s.goalDayDate as admin.firestore.Timestamp | undefined)?.toDate() ?? null,
        goalDayWords: (s.goalDayWords as number) ?? 0,
      }
      const next = nextStats(current, delta, createdAt, timeZone)

      tx.update(journalRef, {
        content: encryptField(dek, newContent, 'journals.content'),
        transcriptStatus: 'ready',
        wordCount: newWordCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // We read the full `stats` map in this transaction and write back every
      // field we track, so the merged replacement of `stats` is safe.
      const statsPayload: Record<string, unknown> = {
        streakCount: next.streakCount,
        totalWords: next.totalWords,
        goalDayWords: next.goalDayWords,
      }
      if (next.lastEntryDate) {
        statsPayload.lastEntryDate = admin.firestore.Timestamp.fromDate(next.lastEntryDate)
      }
      if (next.goalDayDate) {
        statsPayload.goalDayDate = admin.firestore.Timestamp.fromDate(next.goalDayDate)
      }
      tx.set(userRef, { stats: statsPayload }, { merge: true })
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

    // The transcript is the entry's first real content, so generate + index its
    // summary vector here too. Without this, voice/video entries (which only ever
    // reach the server via transcription) would never get a summary vector and
    // would be invisible to the constellation graph and the "Related" tab.
    // force: true because the freshly added transcript materially changes content.
    let summaryIndexed = false
    try {
      summaryIndexed = await ensureEntrySummaryIndexed({
        uid,
        journalId,
        data,
        content: newContent,
        title: openField(dek, data.title, 'journals.title'),
        type: data.type ?? 'voice',
        date: new Date().toISOString().slice(0, 10),
        dek,
        force: true,
      })
    } catch (err) {
      console.error('[ai/transcribe] summary step failed (transcript kept)', err)
    }

    await db.collection('journals').doc(journalId).update({
      vector: {
        status: 'indexed',
        chunkCount: indexResult.chunks,
        summaryIndexed,
        indexedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    })

    // Emotion scoring reuses the audio already decoded above (no second S3 fetch).
    await scoreEntryEmotion({
      uid, journalId, content: newContent, data,
      downloadAudio: async () => audioBuffer,
      force: true, // transcript is the entry's first real content
    })

    // The user's similarity graph changed — drop the cache so the next /graph
    // call rebuilds with this entry's new summary vector.
    invalidateGraph(uid)

    res.json({ transcribed: true, chunks: indexResult.chunks })
  } catch (err) {
    console.error('[ai/transcribe]', err)
    await db.collection('journals').doc(journalId)
      .update({ transcriptStatus: 'failed' })
      .catch(() => {})
    res.status(500).json({ error: 'Transcription failed' })
  }
}

aiRouter.post('/transcribe', firebaseAuth, transcribeHandler)
