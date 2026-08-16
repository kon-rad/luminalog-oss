import { hasRealizationMarker, keepScore } from './score'
import type { Beat, CandidateBeat, Edge } from './types'

const MAX_DRAWN = 9
const MIN_DRAWN = 1
const MAX_KEEPERS = 2
const KEEPER_SCORE_FLOOR = 0.62
const KEEPER_GENERALITY_FLOOR = 0.6
const PROMOTION_GENERALITY = 0.7

/**
 * Turn verified candidates plus edges into the final beats: degree, keepScore, tier,
 * and keeper flags.
 *
 * The pruning rule is structural rather than a score threshold, and that is the whole
 * idea: a beat that nothing caused and that caused nothing did not matter. "Paid
 * rent." "Weather was nice." They survive only if something hangs off them, they are
 * general enough to be a keeper candidate, they carry an entity, or they are spine.
 *
 * Everything that does not survive stays as `tier: 'ledger'`. That tier is not waste:
 * it is stored, decryptable, and it is the raw material the entity registry and
 * thread detection will be built from. It simply is not the map. A map that shows
 * everything shows nothing.
 */
export function buildBeats(candidates: CandidateBeat[], edges: Edge[]): Beat[] {
  const degree = new Map<string, number>(candidates.map(c => [c.id, 0]))
  for (const e of edges) {
    if (degree.has(e.from)) degree.set(e.from, degree.get(e.from)! + 1)
    if (degree.has(e.to)) degree.set(e.to, degree.get(e.to)! + 1)
  }

  const order = new Map(candidates.map((c, i) => [c.id, i]))

  const scored = candidates.map(candidate => {
    const d = degree.get(candidate.id) ?? 0
    return {
      candidate,
      degree: d,
      score: keepScore({
        generality: candidate.generality,
        degree: d,
        crossLinkCount: 0,
        hasRealizationMarker: hasRealizationMarker(candidate.quote),
      }),
    }
  })

  const qualifies = (s: (typeof scored)[number]): boolean =>
    s.degree > 0 ||
    s.candidate.generality >= PROMOTION_GENERALITY ||
    s.candidate.mentions.length > 0 ||
    s.candidate.isSpine

  // Rank by score, then by original order so ties are stable and the whole pipeline
  // stays deterministic.
  const byScore = (a: (typeof scored)[number], b: (typeof scored)[number]) => {
    const delta = b.score - a.score
    return delta !== 0 ? delta : order.get(a.candidate.id)! - order.get(b.candidate.id)!
  }

  const ranked = scored.filter(qualifies).sort(byScore)
  const drawn = new Set(ranked.slice(0, MAX_DRAWN).map(s => s.candidate.id))

  // Floor: a very short entry can leave nothing eligible, and an empty map is worse
  // than a one-beat map. Fall back to the single highest-scoring candidate.
  if (drawn.size < MIN_DRAWN && scored.length > 0) {
    drawn.add([...scored].sort(byScore)[0]!.candidate.id)
  }

  // Spine reconciliation, AFTER the cap: a map with zero spine beats has no
  // through-line, so if the cap removed every one of them, put the best back.
  const spineCandidates = ranked.filter(s => s.candidate.isSpine)
  if (spineCandidates.length > 0 && !spineCandidates.some(s => drawn.has(s.candidate.id))) {
    drawn.add(spineCandidates[0]!.candidate.id)
  }

  // Keepers are chosen from the DRAWN set only, capped, and gated on a generality
  // floor so a well-connected chronicle beat can never become a keeper. Zero keepers
  // is normal: roughly one entry in two or three has any.
  const keeperIds = new Set(
    ranked
      .filter(s =>
        drawn.has(s.candidate.id) &&
        s.score >= KEEPER_SCORE_FLOOR &&
        s.candidate.generality >= KEEPER_GENERALITY_FLOOR)
      .slice(0, MAX_KEEPERS)
      .map(s => s.candidate.id),
  )

  return scored.map(s => ({
    id: s.candidate.id,
    tier: drawn.has(s.candidate.id) ? ('map' as const) : ('ledger' as const),
    kind: s.candidate.kind,
    text: s.candidate.text,
    quote: s.candidate.quote,
    quoteStart: s.candidate.quoteStart,
    domain: s.candidate.domain,
    isSpine: s.candidate.isSpine,
    isKeeper: keeperIds.has(s.candidate.id),
    generality: s.candidate.generality,
    keepScore: Math.round(s.score * 1000) / 1000,
    degree: s.degree,
    mentions: s.candidate.mentions,
  }))
}
