// Hume Expression Measurement (batch) client. Returns normalized emotion maps.
// Graceful-null when HUME_API_KEY is unset or any call fails — callers skip scoring.
// We use the batch API over raw fetch (no extra dep, trivially mockable) and a
// defensive parser, since Hume nests emotions differently per model/input.
import { config } from '../config'

const BASE = 'https://api.hume.ai/v0/batch'
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 60_000

export interface EmotionPick { name: string; score: number }
export interface RawEmotions { scores: Record<string, number>; top: EmotionPick[] }

/** Recursively collect every `emotions: [{name,score}]` array, average by name. */
export function normalizeEmotions(predictions: unknown): Record<string, number> {
  const sums: Record<string, { total: number; n: number }> = {}
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      const emotions = obj.emotions
      if (Array.isArray(emotions)) {
        for (const e of emotions) {
          const name = (e as any)?.name
          const score = (e as any)?.score
          if (typeof name === 'string' && typeof score === 'number') {
            const acc = (sums[name] ??= { total: 0, n: 0 })
            acc.total += score; acc.n += 1
          }
        }
      }
      for (const v of Object.values(obj)) walk(v)
    }
  }
  walk(predictions)
  const out: Record<string, number> = {}
  for (const [name, { total, n }] of Object.entries(sums)) out[name] = total / n
  return out
}

export function topN(scores: Record<string, number>, n: number): EmotionPick[] {
  return Object.entries(scores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function runJob(body: string | FormData, headers: Record<string, string>): Promise<RawEmotions | null> {
  if (!config.HUME_API_KEY) return null
  const auth = { 'X-Hume-Api-Key': config.HUME_API_KEY }
  const start = await fetch(`${BASE}/jobs`, { method: 'POST', headers: { ...auth, ...headers }, body })
  if (!start.ok) return null
  const { job_id: jobId } = (await start.json()) as { job_id?: string }
  if (!jobId) return null

  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const stateRes = await fetch(`${BASE}/jobs/${jobId}`, { headers: auth })
    if (!stateRes.ok) continue
    const stateBody = (await stateRes.json()) as { state?: { status?: string } }
    const status = stateBody?.state?.status
    if (status === 'COMPLETED') break
    if (status === 'FAILED') return null
  }
  if (Date.now() >= deadline) return null
  const predRes = await fetch(`${BASE}/jobs/${jobId}/predictions`, { headers: auth })
  if (!predRes.ok) return null
  const predictions = await predRes.json()
  const scores = normalizeEmotions(predictions)
  if (Object.keys(scores).length === 0) return null
  return { scores, top: topN(scores, 10) }
}

/** Score raw text with the Hume `language` model. */
/**
 * Emotion detection is DISABLED (2026-07-10 privacy decision): NO journal text or
 * audio is sent to api.hume.ai. `scoreText`/`scoreAudio` return null at the top, so
 * every caller (entry scoring, daily report) gracefully records no emotion. Flip this
 * to `true` to re-enable the Hume integration.
 */
const HUME_ENABLED = false

export async function scoreText(text: string): Promise<RawEmotions | null> {
  if (!HUME_ENABLED) return null
  if (!text.trim()) return null
  try {
    return await runJob(
      JSON.stringify({ text: [text], models: { language: {} } }),
      { 'Content-Type': 'application/json' },
    )
  } catch { return null }
}

/** Score an audio buffer with the Hume `prosody` model (multipart upload). */
export async function scoreAudio(buffer: Buffer, filename = 'audio.m4a'): Promise<RawEmotions | null> {
  if (!HUME_ENABLED) return null
  try {
    const form = new FormData()
    form.append('json', JSON.stringify({ models: { prosody: {} } }))
    form.append('file', new Blob([buffer]), filename)
    return await runJob(form, {})
  } catch { return null }
}
