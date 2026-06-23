import { Request, Response } from 'express'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, encryptField } from '../crypto/fieldCipher'
import { retrieveContext } from '../services/journalRetriever'
import { searchPhoto } from '../services/unsplashService'
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

function aggregateEmotions(entries: Array<Record<string, any>>): Array<{ name: string; score: number }> {
  const sums: Record<string, { total: number; n: number }> = {}
  for (const e of entries) {
    const scores: Record<string, number> = e.emotion?.scores ?? {}
    for (const [name, score] of Object.entries(scores)) {
      const acc = (sums[name] ??= { total: 0, n: 0 }); acc.total += score; acc.n += 1
    }
  }
  return Object.entries(sums).map(([name, { total, n }]) => ({ name, score: total / n }))
    .sort((a, b) => b.score - a.score).slice(0, 3)
}

function parseReportJson(raw: string): { insights: string; findings: string; question: string; emotionSummary: string; imageQuery: string } | null {
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

async function llm(prompt: string): Promise<string> {
  const r = await chatCompletion(
    [{ role: 'user', content: prompt }],
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

    const reportRef = db.collection('dailyReports').doc(uid).collection('days').doc(dateKey)
    const existing = await reportRef.get()
    if (existing.exists && !force) { res.json(decryptReport(dek, existing.data()!)); return }

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

    const todayText = entries
      .map((e: any) => openField(dek, e.content, 'journals.content'))
      .filter(Boolean).join('\n\n')
    const relatedContext = await retrieveContext(uid, todayText.slice(0, 1000), dek).catch(() => '')
    const topEmotions = aggregateEmotions(entries as any)

    const prompt = PROMPTS.dailyReport({
      name: (user.displayName as string)?.split(' ')[0] ?? '',
      todayText, relatedContext, topEmotions,
    })
    const raw1 = await llm(prompt)
    let parsed = parseReportJson(raw1)
    if (!parsed) {
      const raw2 = await llm(prompt)
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
      insights: parsed.insights, findings: parsed.findings, question: parsed.question,
      emotionSummary: parsed.emotionSummary,
      totalWords: stats.totalWords ?? 0,
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

    await reportRef.set(encryptReport(dek, report))
    res.json(report)
  } catch (err: any) {
    console.error('[ai/daily-report]', err)
    res.status(500).json({ error: err.message })
  }
}
