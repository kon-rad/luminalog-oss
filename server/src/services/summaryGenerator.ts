import { chatCompletion } from './aiClient'
import { PROMPTS } from './prompts'
import { resolveSummaryConfig, SummaryConfig } from '../config/summaryDefaults'

export const SUMMARY_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

export async function generateSummaryText(params: {
  type: string
  content: string
  userConfig: Partial<SummaryConfig> | undefined | null
}): Promise<{ text: string; model: string; generatedAt: string }> {
  const cfg = resolveSummaryConfig(params.userConfig)
  const res = await chatCompletion(
    [
      { role: 'system', content: PROMPTS.summary(params.type, cfg) },
      { role: 'user', content: params.content },
    ],
    { model: SUMMARY_MODEL },
  )
  if (!res.ok) throw new Error(`Together AI error: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return {
    text: data.choices[0].message.content.trim(),
    model: SUMMARY_MODEL,
    generatedAt: new Date().toISOString(),
  }
}

export interface EntryAI {
  /** Plain-text summary (~configured word length). */
  summary: string
  /** Markdown insights (## headings, - bullets). */
  insights: string
  /** Exactly-up-to-5 follow-up questions, each ending in '?'. */
  prompts: string[]
}

/**
 * Tolerant parser for the combined entry-AI JSON. JSON mode
 * (`response_format: json_object`) makes a valid object the norm; this mirrors
 * `parseReportJson` / `parseDailyPrompts` and additionally tolerates stray prose
 * or ``` fences by slicing the first `{…}` block. Coerces + validates: trims the
 * text fields and keeps only prompt strings ending in '?' (max 5). Returns null
 * when there is no JSON object or the summary is empty, so the caller can treat
 * it as a generation failure.
 */
export function parseEntryAI(raw: string): EntryAI | null {
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }
  const summary = (parsed?.summary ?? '').toString().trim()
  const insights = (parsed?.insights ?? '').toString().trim()
  const prompts = (Array.isArray(parsed?.prompts) ? parsed.prompts : [])
    .map((p: any) => (p ?? '').toString().trim())
    .filter((p: string) => p.endsWith('?'))
    .slice(0, 5)
  if (!summary) return null
  return { summary, insights, prompts }
}

/**
 * Generates the entry's summary + insights + 5 prompts in ONE Together AI call
 * (STRICT JSON). Summary length/tone follow the user's resolved summaryConfig,
 * exactly like `generateSummaryText`. Throws on a non-ok completion or an
 * unparseable response (no valid JSON / empty summary), so callers keep the
 * entry's content even when the AI step fails.
 */
export async function generateEntryAI(params: {
  type: string
  content: string
  userConfig: Partial<SummaryConfig> | undefined | null
}): Promise<EntryAI & { model: string; generatedAt: string }> {
  const cfg = resolveSummaryConfig(params.userConfig)
  const res = await chatCompletion(
    [
      { role: 'system', content: PROMPTS.entryAI(params.type, cfg) },
      { role: 'user', content: params.content },
    ],
    { model: SUMMARY_MODEL, response_format: { type: 'json_object' } },
  )
  if (!res.ok) throw new Error(`Together AI error: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  const parsed = parseEntryAI(data.choices[0]?.message?.content ?? '')
  if (!parsed) throw new Error('Entry AI: unparseable response')
  return { ...parsed, model: SUMMARY_MODEL, generatedAt: new Date().toISOString() }
}
