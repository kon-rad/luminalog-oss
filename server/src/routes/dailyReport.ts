import { Request, Response } from 'express'
import { db } from '../middleware/firebaseAuth'
import { searchPhoto } from '../services/unsplashService'
import { scoreText } from '../services/humeService'
import { chatCompletion, DEFAULT_CHAT_MODEL } from '../services/aiClient'
import { PROMPTS } from '../services/prompts'

/** Calendar-day [start,end) for `date` in `timeZone`, as UTC instants. */
export function dayBounds(date: Date, timeZone: string): { start: Date; end: Date } {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  // Find the UTC instant corresponding to local midnight in `timeZone`.
  const utcMidnight = new Date(`${ymd}T00:00:00Z`)
  // Offset of `timeZone` at that instant: compare the same instant rendered in
  // `timeZone` vs UTC (both parsed in server-local, so the offset cancels out).
  const inTz = new Date(utcMidnight.toLocaleString('en-US', { timeZone }))
  const inUtc = new Date(utcMidnight.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offsetMs = inTz.getTime() - inUtc.getTime()
  const start = new Date(utcMidnight.getTime() - offsetMs)
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

function parseReportJson(raw: string): { insights: string; findings: string; gem: string; emotionSummary: string; imageQuery: string } | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  } catch { return null }
}

// The full instructions + the day's writing + RAG context live in the SYSTEM
// prompt (PROMPTS.dailyReport); the user turn just triggers generation.
async function llm(systemPrompt: string): Promise<string> {
  const r = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the shareable daily insights card now as strict JSON.' },
    ],
    { model: DEFAULT_CHAT_MODEL, response_format: { type: 'json_object' } },
  )
  if (!r.ok) throw new Error(`LLM error ${r.status}`)
  return ((await r.json()) as { choices: Array<{ message: { content: string } }> })?.choices?.[0]?.message?.content ?? ''
}

// Zero-knowledge only: the client sends the full day's writing as PLAINTEXT
// (`todayText`) plus its client-side RAG `relatedContext`. The server NEVER decrypts,
// reads no cache (cached reports are client-encrypted; the client dedupes), and never
// persists — the client stores the returned report. A synthetic `id` keeps the
// response shape unchanged.
export async function dailyReportHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const { date: dateArg, todayText: bodyTodayText, relatedContext: bodyRelatedContext,
    sourceEntryIds: bodySourceEntryIds, name: bodyName } = (req.body ?? {}) as {
      date?: string; force?: boolean; todayText?: string; relatedContext?: string
      sourceEntryIds?: string[]; name?: string
    }

  try {
    const userSnap = await db.collection('users').doc(uid).get()
    const user = userSnap.data() ?? {}
    const timeZone = (user.timezone as string) || 'UTC'
    const now = dateArg ? new Date(`${dateArg}T12:00:00`) : new Date()
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

    if (typeof bodyTodayText !== 'string') {
      res.status(400).json({ error: 'Missing client context (todayText)' }); return
    }
    const todayText = bodyTodayText
    if (!todayText.trim()) { res.status(409).json({ error: 'No entries to share today' }); return }
    const relatedContext = bodyRelatedContext ?? ''
    const sourceEntryIds = bodySourceEntryIds ?? []

    // Words the user entered today across ALL entry types — typed text plus
    // transcribed voice/video all land in `content`. Shown under "WORDS TODAY".
    const wordsToday = todayText.trim() ? todayText.trim().split(/\s+/).length : 0
    const hume = await scoreText(todayText).catch(() => null)
    const topEmotions: Array<{ name: string; score: number }> = hume ? hume.top.slice(0, 3) : []

    const systemPrompt = PROMPTS.dailyReport({
      name: (bodyName ?? (user.displayName as string) ?? '').split(' ')[0] ?? '',
      todayText, relatedContext, topEmotions,
    })
    const raw1 = await llm(systemPrompt)
    let parsed = parseReportJson(raw1)
    if (!parsed) {
      const raw2 = await llm(systemPrompt)
      parsed = parseReportJson(raw2)
      if (!parsed) {
        console.error('[daily-report] LLM non-JSON:', raw2.slice(0, 500))
        res.status(502).json({ error: 'Could not generate report' }); return
      }
    }

    const photo = await searchPhoto(parsed.imageQuery).catch(() => null)
    const stats = (user.stats as Record<string, number>) ?? {}

    const report = {
      date: dateKey,
      // The LLM emits `gem`; the stored field name `question` is kept for compat (ADR-0038).
      insights: parsed.insights, findings: parsed.findings, question: parsed.gem,
      emotionSummary: parsed.emotionSummary,
      totalWords: stats.totalWords ?? 0,
      wordsToday,
      streakCount: stats.streakCount ?? 0,
      emotions: topEmotions,
      imageUrl: photo?.imageUrl ?? null,
      imageThumbUrl: photo?.imageThumbUrl ?? null,
      imageQuery: parsed.imageQuery,
      photographerName: photo?.photographerName ?? null,
      photographerUrl: photo?.photographerUrl ?? null,
      sourceEntryIds,
      model: DEFAULT_CHAT_MODEL,
      generatedAt: new Date().toISOString(),
    }

    res.json({ id: `${dateKey}_${new Date().getTime()}`, ...report })
  } catch (err: any) {
    console.error('[ai/daily-report]', err)
    res.status(500).json({ error: err.message })
  }
}
