import { chatCompletion, activeChatModel, chatModelChain } from './aiClient'
import { PROMPTS } from './prompts'
import { resolveSummaryConfig, SummaryConfig } from '../config/summaryDefaults'

export async function generateSummaryText(params: {
  type: string
  content: string
  userConfig: Partial<SummaryConfig> | undefined | null
}): Promise<{ text: string; model: string; generatedAt: string }> {
  const cfg = resolveSummaryConfig(params.userConfig)
  // The active provider (AI_PROVIDER) picks the model — don't pass a hardcoded id.
  const res = await chatCompletion([
    { role: 'system', content: PROMPTS.summary(params.type, cfg) },
    { role: 'user', content: params.content },
  ])
  if (!res.ok) throw new Error(`AI error: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return {
    text: data.choices[0].message.content.trim(),
    model: activeChatModel(),
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
    .map((p: any) =>
      (p ?? '')
        .toString()
        .trim()
        // Normalize decorative / full-width question marks (？﹖⁇) and strip a
        // trailing wrapping quote so a well-formed question isn't discarded on a
        // punctuation quirk — that previously dropped ALL prompts, leaving the
        // entry's Prompts tab stuck showing a spinner (ADR-0081).
        .replace(/["'”’]$/, '')
        .replace(/[？﹖⁇]$/, '?'),
    )
    .filter((p: string) => p.endsWith('?'))
    .slice(0, 5)
  if (!summary) return null
  return { summary, insights, prompts }
}

/**
 * Generates the entry's summary + insights + 5 prompts in ONE LLM call (STRICT
 * JSON). Summary length/tone follow the user's resolved summaryConfig, exactly like
 * `generateSummaryText`.
 *
 * RESILIENCE: walks the provider's model chain (`chatModelChain()` — the primary
 * Morpheus slug followed by its configured fallbacks; a single model for Together).
 * Morpheus per-model priority-gating means the primary can 503 while another slug
 * still serves, so a non-ok completion OR an unparseable/empty result advances to
 * the next model instead of failing outright. The response is stamped with the model
 * that actually produced it. Throws only when EVERY model in the chain fails, so
 * callers keep the entry's content even when the AI step can't complete. All models
 * are on the same private provider — there is no cross-provider fallback.
 */
export async function generateEntryAI(params: {
  type: string
  content: string
  userConfig: Partial<SummaryConfig> | undefined | null
}): Promise<EntryAI & { model: string; generatedAt: string }> {
  const cfg = resolveSummaryConfig(params.userConfig)

  // One full attempt against a single model, including the promptless double-try.
  const generateWith = async (model: string): Promise<EntryAI | null> => {
    const generate = async (): Promise<EntryAI | null> => {
      const res = await chatCompletion(
        [
          { role: 'system', content: PROMPTS.entryAI(params.type, cfg) },
          { role: 'user', content: params.content },
        ],
        { model, response_format: { type: 'json_object' } },
      )
      if (!res.ok) throw new Error(`AI error: ${res.status}`)
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
      return parseEntryAI(data.choices[0]?.message?.content ?? '')
    }
    let parsed = await generate()
    // Retry once when the model returns a valid summary but no usable prompts —
    // otherwise the entry persists with an empty Prompts tab (ADR-0081). Mirrors
    // the daily-prompt double-try. If the retry is still promptless we keep the
    // first result (summary + insights survive) rather than failing this model.
    if (parsed && parsed.prompts.length === 0) {
      const retry = await generate()
      if (retry && retry.prompts.length > 0) parsed = retry
    }
    return parsed
  }

  const chain = chatModelChain()
  let lastErr: unknown = new Error('Entry AI: unparseable response')
  for (const model of chain) {
    try {
      const parsed = await generateWith(model)
      if (parsed) return { ...parsed, model, generatedAt: new Date().toISOString() }
      // parsed === null (unparseable / empty summary): try the next model.
    } catch (err) {
      // Non-ok completion (e.g. a 503 that outlived its per-request retries):
      // try the next model in the chain.
      lastErr = err
    }
  }
  throw lastErr
}
