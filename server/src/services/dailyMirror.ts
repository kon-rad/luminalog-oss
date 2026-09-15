// Pure logic for Mirror's three daily Echo notifications: one short sentence
// per delivery window (morning/afternoon/evening). Kept dependency-free so it
// can be unit-tested without booting config/Firebase, exactly like
// `dailyEncouragements.ts` and `dailyPrompts.ts`.

export type MirrorTimeOfDay = 'morning' | 'afternoon' | 'evening'

/** Fixed delivery order, matching the iOS `EncouragementSlot.all` slot order. */
export const MIRROR_TIME_SLOTS: readonly MirrorTimeOfDay[] = ['morning', 'afternoon', 'evening']

/** Lock-screen safe length: longer text is truncated by iOS, not by us. */
export const MIRROR_TEXT_MAX = 220

/** Matching quote-character pairs a model reply might wrap the sentence in. */
const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’'],
]

function stripWrappingQuotes(text: string): string {
  for (const [open, close] of QUOTE_PAIRS) {
    if (text.length >= open.length + close.length && text.startsWith(open) && text.endsWith(close)) {
      return text.slice(open.length, text.length - close.length).trim()
    }
  }
  return text
}

/**
 * Cleans one raw model reply into a single Echo sentence: strips a wrapping
 * quote pair the model added despite being told not to, trims, and hard-clamps
 * to the notification-safe length. No JSON parsing: the prompt is instructed to
 * return the bare sentence and nothing else. Returns '' when nothing usable
 * came back, so the caller can retry once before falling back.
 */
export function cleanEcho(raw: string): string {
  let text = stripWrappingQuotes(raw.trim()).trim()
  if (text.length > MIRROR_TEXT_MAX) text = text.slice(0, MIRROR_TEXT_MAX).trimEnd()
  return text
}

/**
 * Generic sentences used when the model returns nothing parseable twice.
 * Deliberately gentle and non-specific: they should read as calm rather than
 * as a personalized message that failed.
 */
const FALLBACKS: Record<MirrorTimeOfDay, string> = {
  morning: 'Whatever is looping in your head right now can wait until you have written the first line of today.',
  afternoon: 'The friction you are feeling this afternoon is information, not a verdict on how the day is going.',
  evening: 'One honest sentence about today is enough; let the rest close on its own.',
}

export function fallbackEcho(timeOfDay: MirrorTimeOfDay): string {
  return FALLBACKS[timeOfDay]
}

/** All three slots' fallback sentences at once, for when the batch call never parses. */
export function fallbackMirrorEchoes(): Record<MirrorTimeOfDay, string> {
  const echoes = {} as Record<MirrorTimeOfDay, string>
  for (const timeOfDay of MIRROR_TIME_SLOTS) echoes[timeOfDay] = fallbackEcho(timeOfDay)
  return echoes
}

/**
 * Parses the LLM's single JSON reply into all three Echoes at once. Tolerant
 * of prose around the JSON object. A slot missing from the JSON, or whose
 * value cleans to '', falls back to that slot's `fallbackEcho` individually
 * rather than failing the whole batch. Returns null only when no JSON object
 * is present or it fails to parse at all, so the caller can retry the single
 * call once before falling back entirely.
 */
export function parseMirrorEchoes(raw: string): Record<MirrorTimeOfDay, string> | null {
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }
  const echoes = {} as Record<MirrorTimeOfDay, string>
  for (const timeOfDay of MIRROR_TIME_SLOTS) {
    echoes[timeOfDay] = cleanEcho((parsed?.[timeOfDay] ?? '').toString()) || fallbackEcho(timeOfDay)
  }
  return echoes
}
