import express, { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { transcribeClipHandler } from './transcribeClip'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { chatCompletion, transcribeAudio, streamToBuffer } from '../services/aiClient'
import { indexJournalEntry } from '../services/journalIndexer'
import { extractAudio } from '../services/audioExtractor'
import { PROMPTS } from '../services/prompts'
import { generateSummaryText, generateEntryAI } from '../services/summaryGenerator'
import { ensureEntryAIIndexed } from '../services/summaryService'
import { invalidateGraph } from '../services/graphBuilder'
import { config } from '../config'
import type { ProfileFields } from '../services/profileContext'
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
    // Zero-knowledge: the client sends the entry's PLAINTEXT `content` directly; the
    // server never decrypts. 400 without it.
    if (typeof bodyContent !== 'string') {
      res.status(400).json({ error: 'Missing content' }); return
    }
    const content = bodyContent
    const type = bodyType ?? 'text'

    const userConfig = await fetchUserSummaryConfig(uid)
    const out = await generateSummaryText({ type, content, userConfig })
    res.json({ text: out.text, model: out.model, generatedAt: out.generatedAt })
  } catch (err: any) {
    console.error('[ai/summary]', err)
    res.status(err.status ?? 500).json({ error: err.message })
  }
}

aiRouter.post('/summary', firebaseAuth, summaryHandler)

// Zero-knowledge (Model-1) full-entry AI: the client sends the entry's PLAINTEXT
// content and gets { summary, insights, prompts } back in ONE LLM call — the same
// three artifacts `ensureEntryAIIndexed` produces at index time on the legacy path.
// STATELESS: no getOrCreateDEK, no Firestore write. The client persists the fields
// itself (client-encrypted) via `updateAIFields`, so the Insights/Prompts tabs light
// up for migrated accounts the server can no longer index. Gated by AI_MODEL1.
export async function entryAiHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const { content, type } = req.body as { content?: string; type?: string }

  try {
    if (typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Missing content' }); return
    }
    const userConfig = await fetchUserSummaryConfig(uid)
    const ai = await generateEntryAI({ type: type ?? 'text', content, userConfig })
    res.json({
      summary: ai.summary,
      insights: ai.insights,
      prompts: ai.prompts,
      model: ai.model,
      generatedAt: ai.generatedAt,
    })
  } catch (err: any) {
    console.error('[ai/entry-ai]', err)
    res.status(err.status ?? 500).json({ error: err.message })
  }
}

aiRouter.post('/entry-ai', firebaseAuth, entryAiHandler)

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
    if (!Array.isArray(body.entries)) {
      res.status(400).json({ error: 'Missing client context (entries)' }); return
    }
    {
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


aiRouter.post('/daily-report', firebaseAuth, dailyReportHandler)
