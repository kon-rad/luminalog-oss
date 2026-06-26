import { Request, Response } from 'express'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, openFieldSafe, encryptField } from '../crypto/fieldCipher'
import { retrieveContext } from '../services/journalRetriever'
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

const ENC_FIELDS = ['insights', 'findings', 'question', 'emotionSummary'] as const

function encryptReport(dek: Buffer, report: Record<string, any>): Record<string, any> {
  const out = { ...report }
  for (const f of ENC_FIELDS) out[f] = encryptField(dek, report[f] ?? '', `dailyReports.${f}`)
  return out
}
function decryptReport(dek: Buffer, data: Record<string, any>): Record<string, any> {
  const out = { ...data }
  for (const f of ENC_FIELDS) out[f] = openField(dek, data[f], `dailyReports.${f}`)
  return out
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

export async function dailyReportHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const { date: dateArg, force } = (req.body ?? {}) as { date?: string; force?: boolean }

  try {
    const userSnap = await db.collection('users').doc(uid).get()
    const user = userSnap.data() ?? {}
    const timeZone = (user.timezone as string) || 'UTC'
    const dek = await getOrCreateDEK(uid)

    const now = dateArg ? new Date(`${dateArg}T12:00:00`) : new Date()
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

    // Reports are stored one document per generation, keyed `{dateKey}_{millis}`,
    // so a single day can hold several. On a non-forced request, return the most
    // recent report already saved for the day instead of regenerating; `force`
    // (the dev tool, and retry) always generates and appends a fresh document.
    const daysCol = db.collection('dailyReports').doc(uid).collection('days')
    if (!force) {
      const latest = await daysCol
        .orderBy(admin.firestore.FieldPath.documentId(), 'desc')
        .startAt(`${dateKey}_`)
        .endAt(`${dateKey}_`)
        .limit(1)
        .get()
      if (!latest.empty) {
        const doc = latest.docs[0]
        res.json({ id: doc.id, ...decryptReport(dek, doc.data()) })
        return
      }
    }

    const { start, end } = dayBounds(now, timeZone)
    const snap = await db.collection('journals')
      .where('userId', '==', uid)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(end))
      .get()

    const entries = snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .filter((e: any) => e.excludeFromShare !== true)
    if (entries.length === 0) { res.status(409).json({ error: 'No entries to share today' }); return }

    // Full day's writing — the entire day's entries, never truncated — is what
    // the report reflects on and what we score for emotion.
    const todayText = entries
      .map((e: any) => openField(dek, e.content, 'journals.content'))
      .filter(Boolean).join('\n\n')

    // Words the user entered today across ALL entry types — typed text plus
    // transcribed voice/video all land in `content`, so counting `todayText`
    // covers every modality. Shown on the card under "WORDS TODAY".
    const wordsToday = todayText.trim() ? todayText.trim().split(/\s+/).length : 0

    // RAG retrieval is driven by the SUMMARY of the day's entries (the per-entry
    // summaries we already persist), so related past reflections are matched on
    // the day's distilled themes rather than its raw opening words. Falls back to
    // the full day's text when no entry has a summary yet.
    const daySummary = entries
      .map((e: any) => openFieldSafe(dek, e.summary?.text, 'journals.summary.text'))
      .filter(Boolean).join('\n\n')
    const relatedContext = await retrieveContext(uid, daySummary || todayText, dek).catch(() => '')
    const hume = await scoreText(todayText).catch(() => null)
    const topEmotions: Array<{ name: string; score: number }> = hume ? hume.top.slice(0, 3) : []

    // System prompt carries the instructions, the full day's writing, and the
    // RAG-retrieved related reflections (see PROMPTS.dailyReport).
    const systemPrompt = PROMPTS.dailyReport({
      name: (user.displayName as string)?.split(' ')[0] ?? '',
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
      // The LLM emits `gem`; we keep the stored/encrypted field name `question`
      // (AAD `dailyReports.question`) unchanged for backward compat — see ADR-0038.
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
      sourceEntryIds: entries.map((e: any) => e.id),
      model: DEFAULT_CHAT_MODEL,
      generatedAt: new Date().toISOString(),
    }

    // One document per generation: `{dateKey}_{millis}` keeps the day's reports
    // ordered chronologically by id and lets a day hold multiple cards.
    const reportId = `${dateKey}_${Date.now()}`
    await daysCol.doc(reportId).set(encryptReport(dek, report))
    res.json({ id: reportId, ...report })
  } catch (err: any) {
    console.error('[ai/daily-report]', err)
    res.status(500).json({ error: err.message })
  }
}
