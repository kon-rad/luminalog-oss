import {
  BEAT_KINDS, DOMAINS, MENTION_TYPES,
  type BeatKind, type CandidateBeat, type Domain, type Mention, type MentionType,
} from './types'

/** A candidate as the model supplies it, before we assign an id and an offset. */
export type RawCandidate = Omit<CandidateBeat, 'id' | 'quoteStart'>

/**
 * How many beats to ask for. A fifty-word entry forced to yield twenty beats produces
 * nineteen restatements of the same thought, so the target scales with length:
 * roughly one candidate per twenty-five words, capped at 20 and floored at 3.
 */
export function targetCandidateCount(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(3, Math.min(20, Math.round(words / 25)))
}

function clamp01(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function parseMentions(value: unknown): Mention[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((m: any) => {
    const surface = (m?.surface ?? '').toString().trim()
    const type = (m?.type ?? '').toString().trim()
    if (!surface || !MENTION_TYPES.includes(type as MentionType)) return []
    return [{ surface, type: type as MentionType }]
  })
}

/**
 * Tolerant parser for Pass A. JSON mode makes a valid object the norm; this mirrors
 * `parseEntryAI` and additionally slices the first {...} block so stray prose or
 * fences do not lose the whole extraction.
 *
 * Coercion policy: an unknown DOMAIN degrades to 'other' (the taxonomy is a judgment
 * call and a wrong bucket is survivable), but an unknown KIND drops the beat (kind
 * drives shape, and a shapeless node cannot be drawn). Returns null when nothing
 * usable survives, so the caller can advance to the next model.
 */
export function parseCandidates(raw: string): RawCandidate[] | null {
  let parsed: any
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }

  const list = Array.isArray(parsed?.beats) ? parsed.beats : []
  const beats: RawCandidate[] = list.flatMap((b: any) => {
    const text = (b?.text ?? '').toString().trim()
    const quote = (b?.quote ?? '').toString()
    const kind = (b?.kind ?? '').toString().trim()
    if (!text || !quote.trim()) return []
    if (!BEAT_KINDS.includes(kind as BeatKind)) return []
    const domainRaw = (b?.domain ?? '').toString().trim()
    return [{
      text,
      kind: kind as BeatKind,
      quote,
      domain: (DOMAINS.includes(domainRaw as Domain) ? domainRaw : 'other') as Domain,
      generality: clamp01(b?.generality),
      isSpine: b?.isSpine === true,
      mentions: parseMentions(b?.mentions),
    }]
  })

  return beats.length > 0 ? beats : null
}

/**
 * Verify every quote is an exact substring of the entry, and record its offset.
 *
 * This is the check that makes tap-to-source trustworthy. Models paraphrase quotes
 * constantly, and a map that shows the reader a sentence they did not write breaks
 * the one promise this feature makes: that everything on it points back at their own
 * words. A beat that fails here is offered one repair pass by the caller and then
 * discarded. Ids are assigned only to survivors, so they stay contiguous.
 */
export function verifyQuotes(
  candidates: RawCandidate[],
  content: string,
): { verified: CandidateBeat[]; failed: string[] } {
  const verified: CandidateBeat[] = []
  const failed: string[] = []

  for (const candidate of candidates) {
    const quoteStart = content.indexOf(candidate.quote)
    if (quoteStart < 0) {
      failed.push(candidate.quote)
      continue
    }
    verified.push({ ...candidate, id: `b${verified.length}`, quoteStart })
  }

  return { verified, failed }
}
