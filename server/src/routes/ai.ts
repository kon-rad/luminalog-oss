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
import { ensureEntryAIIndexed } from '../services/summaryService'
import { invalidateGraph } from '../services/graphBuilder'
import { config, aiModel1Enabled } from '../config'
import type { ProfileFields } from '../services/profileContext'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, encryptField } from '../crypto/fieldCipher'
import { decryptMedia } from '../crypto/mediaCipher'
import { nextStats, dayIndex, type GoalStats } from '../services/dailyGoalStreak'
import { updateConstellationForDay } from '../services/constellation/constellationService'
import { ensureSoulMinted, refreshSoulImage } from '../services/chain/soulService'
import { decodeProfileFields } from '../services/profileContext'
import { DAILY_PROMPT_AREAS, parseDailyPrompts, fallbackDailyPrompts } from '../services/dailyPrompts'
import { dailyReportHandler } from './dailyReport'

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

export async function summaryHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const { journalId, content: bodyContent, type: bodyType } = req.body as {
    journalId?: string; content?: string; type?: string
  }

  try {
    let content: string
    let type: string

    // ── Model 1 (zero-knowledge) branch ──────────────────────────────────────
    // The client already holds the DEK and sends the entry's PLAINTEXT `content`
    // directly. We use it verbatim and DO NOT call getOrCreateDEK/openField.
    // Gated by AI_MODEL1 → off in production, so nothing changes until cutover.
    if (aiModel1Enabled() && typeof bodyContent === 'string') {
      content = bodyContent
      type = bodyType ?? 'text'
    } else {
      // ── Legacy path (UNCHANGED — server decrypts). Removed at the 1d cutover.
      if (!journalId) { res.status(400).json({ error: 'Missing journalId' }); return }
      const data = await fetchJournal(journalId, uid)
      content = data.content ?? ''
      type = data.type ?? 'text'
    }

    const userConfig = await fetchUserSummaryConfig(uid)
    const out = await generateSummaryText({ type, content, userConfig })
    res.json({ text: out.text, model: out.model, generatedAt: out.generatedAt })
  } catch (err: any) {
    console.error('[ai/summary]', err)
    res.status(err.status ?? 500).json({ error: err.message })
  }
}

aiRouter.post('/summary', firebaseAuth, summaryHandler)

// Per-entry insights and follow-up prompts are no longer generated on demand:
// they are produced together with the summary in ONE LLM call at index time
// (services/summaryService.ts → ensureEntryAIIndexed) and stored on the entry.
// The Insights/Prompts tabs are read-only displays of those stored fields, so
// the former POST /v1/ai/insights and POST /v1/ai/prompts routes were removed.

// Generates five personalized prompts (one per life area in DAILY_PROMPT_AREAS)
// in a SINGLE LLM call. Called on-demand when the app opens; the client caches
// the result for the day (keyed to the user's local midnight). `text` mirrors
// the first prompt for backward-compatibility with older clients that expect a
// single string.
export async function dailyPromptHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string

  try {
    let sourceEntryIds: string[]
    let context: string
    let name: string
    let profile: ProfileFields

    const body = req.body as {
      entries?: Array<{ id?: string; type?: string; title?: string; content?: string }>
      profile?: ProfileFields
      name?: string
    }

    // ── Model 1 (zero-knowledge) branch ──────────────────────────────────────
    // The client sends its recent entries as PLAINTEXT (already decrypted on
    // device) plus the decrypted profile/name. We build the exact same context
    // string as the legacy path but WITHOUT getOrCreateDEK/openField.
    // Gated by AI_MODEL1 — off in production. Fallback removed at the 1d cutover.
    if (aiModel1Enabled() && Array.isArray(body.entries)) {
      const entries = body.entries
      sourceEntryIds = entries.map(e => e.id).filter((id): id is string => Boolean(id))
      context = entries
        .map(e => {
          const title = (e.title ?? '') || 'Untitled'
          const content = e.content ?? ''
          return `[${e.type ?? 'text'} · ${title}]\n${content.slice(0, 500)}`
        })
        .join('\n\n---\n\n')
      name = ((body.name as string) ?? '').split(' ')[0] ?? ''
      profile = body.profile ?? {}
    } else {
      // ── Legacy path (UNCHANGED — server decrypts). Removed at the 1d cutover.
      const dek = await getOrCreateDEK(uid)

      const [snap, userSnap] = await Promise.all([
        db.collection('journals')
          .where('userId', '==', uid)
          .orderBy('createdAt', 'desc')
          .limit(5)
          .get(),
        db.collection('users').doc(uid).get(),
      ])

      sourceEntryIds = snap.docs.map(d => d.id)
      context = snap.docs
        .map(d => {
          const data = d.data()
          const title = openField(dek, data.title, 'journals.title') || 'Untitled'
          const content = openField(dek, data.content, 'journals.content')
          return `[${data.type ?? 'text'} · ${title}]\n${content.slice(0, 500)}`
        })
        .join('\n\n---\n\n')

      const userData = userSnap.data() ?? {}
      name = ((userData.displayName as string) ?? '').split(' ')[0] ?? ''
      profile = decodeProfileFields(dek, userData)
    }

    const systemPrompt = PROMPTS.dailyPrompts({
      name, profile, journalContext: context, areas: DAILY_PROMPT_AREAS,
    })
    let prompts = parseDailyPrompts(await generate(systemPrompt, 'Generate the prompts now.'))
    if (!prompts) prompts = parseDailyPrompts(await generate(systemPrompt, 'Generate the prompts now.'))
    if (!prompts) prompts = fallbackDailyPrompts()

    res.json({ prompts, text: prompts[0].text, sourceEntryIds })
  } catch (err: any) {
    console.error('[ai/daily-prompt]', err)
    res.status(500).json({ error: err.message })
  }
}

aiRouter.post('/daily-prompt', firebaseAuth, dailyPromptHandler)

// ── server-side audio/video transcription via Together AI Whisper ─────────────
// Called after save when on-device Apple Speech fails (transcriptStatus=failed).
// Downloads the audio/video file from S3, sends to Together AI, updates
// Firestore content+transcriptStatus, then re-indexes to Chroma.

export async function transcribeHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const { journalId, content: bodyContent, title: bodyTitle } = req.body as {
    journalId?: string; content?: string; title?: string
  }
  if (!journalId) { res.status(400).json({ error: 'Missing journalId' }); return }

  // ── Model 1 (zero-knowledge) branch for the MERGE step only ────────────────
  // Unlike the other endpoints, transcribe still needs the DEK: the audio blob
  // is server-encrypted in S3 (decryptMedia) and the merged transcript is
  // re-encrypted back into Firestore (encryptField). So getOrCreateDEK stays.
  // What Model 1 changes: the previously-typed content + title that we MERGE the
  // transcript into can be supplied as client PLAINTEXT instead of decrypted
  // from Firestore. Gated by AI_MODEL1 — off in production. Simplified at 1d.
  const model1Merge =
    aiModel1Enabled() && (typeof bodyContent === 'string' || typeof bodyTitle === 'string')

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

    // Prepend any previously typed text that was saved with the entry. On the
    // Model-1 path the client supplies this plaintext directly; otherwise we
    // decrypt it from Firestore. The entry's title is resolved the same way and
    // reused by the indexer calls below.
    const existingContent = (
      model1Merge && typeof bodyContent === 'string'
        ? bodyContent
        : openField(dek, data.content, 'journals.content')
    ).trim()
    const entryTitle =
      model1Merge && typeof bodyTitle === 'string'
        ? bodyTitle
        : openField(dek, data.title, 'journals.title')
    const newContent = [existingContent, transcript]
      .filter(Boolean)
      .join('\n\n')

    // Recompute the word count from the finished transcript and credit the
    // delta (vs. the count saved at creation) to the daily goal — atomically,
    // so it is retry-safe and never double-counts regardless of client state.
    const journalRef = db.collection('journals').doc(journalId)
    const userRef = db.collection('users').doc(uid)
    const newWordCount = countWords(newContent)

    let createdAt = new Date()
    let timeZone = 'UTC'

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

      createdAt =
        (jData.createdAt as admin.firestore.Timestamp | undefined)?.toDate() ?? new Date()
      timeZone = (uData.timezone as string) || 'UTC'

      const s = (uData.stats as Record<string, unknown>) ?? {}
      const current: GoalStats = {
        streakCount: (s.streakCount as number) ?? 0,
        maxStreakCount: (s.maxStreakCount as number) ?? 0,
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
        maxStreakCount: next.maxStreakCount,
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
      title: entryTitle,
      type: data.type ?? 'voice',
      updatedAt: new Date().toISOString(),
      dayIndex: dayIndex(createdAt, timeZone),
      wordCount: newWordCount,
      dek,
    })

    // Every 750-word day earns a star; the service self-gates on the day's word
    // total, so we can trigger unconditionally after the entry is indexed.
    // Badge pipeline (fire-and-forget, never blocks the response): recompute the
    // point-set, ensure the user has a wallet + minted token, then re-render the
    // hero image from the fresh point-set. Sequential so each step sees the prior.
    updateConstellationForDay(uid, dayIndex(createdAt, timeZone))
      .then(() => ensureSoulMinted(uid))
      .then(() => refreshSoulImage(uid))
      .catch(err => console.error('[soul] badge pipeline failed', err?.message ?? String(err)))

    // The transcript is the entry's first real content, so generate + index its
    // summary vector here too. Without this, voice/video entries (which only ever
    // reach the server via transcription) would never get a summary vector and
    // would be invisible to the constellation graph and the "Related" tab.
    // force: true because the freshly added transcript materially changes content.
    let summaryIndexed = false
    try {
      summaryIndexed = await ensureEntryAIIndexed({
        uid,
        journalId,
        data,
        content: newContent,
        title: entryTitle,
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

aiRouter.post('/daily-report', firebaseAuth, dailyReportHandler)
