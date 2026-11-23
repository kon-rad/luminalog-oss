// Pure logic for Mirror's three daily Echo notifications: one short sentence
// per delivery window (morning/afternoon/evening). Kept dependency-free so it
// can be unit-tested without booting config/Firebase, exactly like
// `dailyEncouragements.ts` and `dailyPrompts.ts`.

export type MirrorTimeOfDay = 'morning' | 'afternoon' | 'evening'

/** Fixed delivery order, matching the iOS `EncouragementSlot.all` slot order. */
export const MIRROR_TIME_SLOTS: readonly MirrorTimeOfDay[] = ['morning', 'afternoon', 'evening']

/** Fits a collapsed lock-screen notification with no title line. */
export const MIRROR_TEXT_MAX = 160

/** Cuts at the last space at or before `max`; text with no space there is hard-cut. */
function clampAtWord(text: string, max: number): string {
  const window = text.slice(0, max + 1)
  const lastSpace = window.lastIndexOf(' ')
  return (lastSpace > 0 ? window.slice(0, lastSpace) : text.slice(0, max)).trimEnd()
}

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
 * quote pair the model added despite being told not to, trims, and clamps
 * to the notification-safe length at a word boundary. No JSON parsing: the prompt is instructed to
 * return the bare sentence and nothing else. Returns '' when nothing usable
 * came back, so the caller can leave that slot empty.
 */
export function cleanEcho(raw: string): string {
  let text = stripWrappingQuotes(raw.trim()).trim()
  if (text.length > MIRROR_TEXT_MAX) text = clampAtWord(text, MIRROR_TEXT_MAX)
  return text
}

export type MirrorEchoes = Record<MirrorTimeOfDay, string | null>

/** Empty slots are preferable to repeating a canned or previously delivered message. */
export function emptyMirrorEchoes(): MirrorEchoes {
  return { morning: null, afternoon: null, evening: null }
}

/**
 * Parses one JSON reply into all three slots. Missing, blank, and repeated
 * values become null. Returns null for unparseable JSON so the route can retry.
 */
export function parseMirrorEchoes(raw: string, previous: readonly string[] = []): MirrorEchoes | null {
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }
  const echoes = emptyMirrorEchoes()
  const seen = new Set(previous.map(normalizeEcho))
  for (const timeOfDay of MIRROR_TIME_SLOTS) {
    const value = parsed?.[timeOfDay]
    const candidate = typeof value === 'string' ? cleanEcho(value) : ''
    const normalized = normalizeEcho(candidate)
    if (candidate && !seen.has(normalized)) {
      echoes[timeOfDay] = candidate
      seen.add(normalized)
    }
  }
  return echoes
}

function normalizeEcho(text: string): string {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
