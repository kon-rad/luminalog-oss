// Pure logic for the five-per-day encouragement messages delivered as local
// notifications. Kept dependency-free so it can be unit-tested without booting
// config/Firebase, exactly like `dailyPrompts.ts`.

/** How many messages one morning batch contains. */
export const ENCOURAGEMENT_COUNT = 5

/** Lock-screen safe lengths: longer text is truncated by iOS, not by us. */
export const ENCOURAGEMENT_TITLE_MAX = 40
export const ENCOURAGEMENT_BODY_MAX = 180

export interface EncouragementItem {
  title: string
  body: string
}

/**
 * Generic messages used when the model returns nothing parseable, and to pad a
 * short list. Deliberately gentle and non-specific: they should read as calm
 * rather than as a personalized message that failed.
 */
const FALLBACKS: EncouragementItem[] = [
  { title: 'One small step', body: 'Pick the smallest next thing you can finish today, and let that be enough.' },
  { title: 'You are still here', body: 'Showing up again is the part most people skip. You did it.' },
  { title: 'Notice the shift', body: 'Something is different from a week ago. Give yourself a moment to see what.' },
  { title: 'Come back to why', body: 'The reason you started is still yours. Hold it lightly and keep walking.' },
  { title: 'Rest counts too', body: 'Progress includes the days you slow down on purpose. Take the pause you need.' },
]

/** Trims and hard-clamps a field to its notification-safe length. */
function clamp(value: unknown, max: number): string {
  const text = (value ?? '').toString().trim()
  return text.length > max ? text.slice(0, max).trimEnd() : text
}

export function fallbackEncouragements(): EncouragementItem[] {
  return FALLBACKS.map(m => ({ ...m }))
}

/**
 * Parses the LLM's JSON into exactly `ENCOURAGEMENT_COUNT` messages. Tolerant of
 * prose around the JSON, of a short list (padded from `FALLBACKS`), and of
 * over-long fields (clamped). Entries missing a body are dropped. Returns null
 * only when no JSON object is present or it fails to parse, so the caller can
 * retry once before falling back entirely.
 */
export function parseEncouragements(raw: string): EncouragementItem[] | null {
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }
  const list: any[] = Array.isArray(parsed?.messages) ? parsed.messages : []
  const items: EncouragementItem[] = []
  for (const entry of list) {
    const body = clamp(entry?.body ?? entry?.text, ENCOURAGEMENT_BODY_MAX)
    if (!body) continue
    const title = clamp(entry?.title, ENCOURAGEMENT_TITLE_MAX) || 'A note for today'
    items.push({ title, body })
    if (items.length === ENCOURAGEMENT_COUNT) break
  }
  const padding = fallbackEncouragements()
  while (items.length < ENCOURAGEMENT_COUNT) {
    items.push(padding[items.length])
  }
  return items
}
