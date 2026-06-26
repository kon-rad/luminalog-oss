// Pure logic for the five-per-day journaling prompts (one per life area).
// Kept dependency-free so it can be unit-tested without booting config/Firebase.

/**
 * The five fixed life areas the daily-prompt carousel renders, in card order.
 * Labels are stable (the iOS UI shows them as chips); only each prompt's
 * question is personalized.
 */
export const DAILY_PROMPT_AREAS = [
  'Relationships',
  'Work & Purpose',
  'Health & Body',
  'Inner World',
  'Joy & Play',
] as const

export interface DailyPromptItem {
  area: string
  text: string
}

/** A gentle generic question for an area the model omitted or left blank. */
function fallbackFor(area: string): string {
  return `What's alive for you in ${area.toLowerCase()} today?`
}

/** Five fallback prompts, used when the model returns no parseable JSON at all. */
export function fallbackDailyPrompts(): DailyPromptItem[] {
  return DAILY_PROMPT_AREAS.map(area => ({ area, text: fallbackFor(area) }))
}

/**
 * Parses the LLM's JSON into one item per area, in `DAILY_PROMPT_AREAS` order.
 * Tolerant of extra prose around the JSON and of a missing/short list — any
 * area the model omitted falls back to a gentle generic question so the client
 * always receives exactly five items. Returns null only when no JSON object is
 * present at all (so the caller can retry once before falling back).
 */
export function parseDailyPrompts(raw: string): DailyPromptItem[] | null {
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }
  const list: any[] = Array.isArray(parsed?.prompts) ? parsed.prompts : []
  return DAILY_PROMPT_AREAS.map((area) => {
    const hit = list.find((p) => typeof p?.area === 'string' && p.area.trim().toLowerCase() === area.toLowerCase())
    const text = (hit?.question ?? hit?.text ?? '').toString().trim()
    return { area, text: text || fallbackFor(area) }
  })
}
