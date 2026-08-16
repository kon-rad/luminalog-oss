/**
 * Realization-marker lexicon. Regex, no model call: cheap and high precision. These
 * are the phrases people write immediately before saying the thing they will still
 * care about in a year.
 */
const REALIZATION_MARKERS = [
  'i realized', 'it hit me', 'it occurred to me', 'what i actually think',
  'the truth is', 'the real reason', 'i keep', 'i always', "maybe i'm",
  'why do i', "i've been telling myself", 'turns out',
]

export function hasRealizationMarker(quote: string): boolean {
  const lower = quote.toLowerCase()
  return REALIZATION_MARKERS.some(marker => lower.includes(marker))
}

/**
 * How much a beat is worth keeping, 0 to 1.
 *
 * Computed in code, never asked of the model. Ask an LLM for a 0-to-1 salience and it
 * returns 0.8 on everything; model-assigned salience is not calibrated and these
 * weights are.
 *
 * The original design carried a fifth term, `novelty` (1 minus cosine to the nearest
 * prior beat), at 0.25. It needs a corpus of prior beats, which does not exist until
 * the cross-entry store does, so it is absent and the remaining four weights are the
 * original ratios renormalized. Adding novelty back later is a weight change, not a
 * rewrite.
 *
 * `crossLinkCount` is always 0 in v1, for the same reason. It stays in the signature
 * so the formula does not change shape when cross-entry links arrive.
 *
 * NOT a signal: emotional intensity. It correlates with memorability but not with
 * value; the worst days produce the most vivid and least useful beats.
 */
export function keepScore(input: {
  generality: number
  degree: number
  crossLinkCount: number
  hasRealizationMarker: boolean
}): number {
  const score =
    0.44 * Math.max(0, Math.min(1, input.generality)) +
    0.19 * Math.min(Math.max(input.degree, 0) / 3, 1) +
    0.19 * Math.min(Math.max(input.crossLinkCount, 0) / 3, 1) +
    0.18 * (input.hasRealizationMarker ? 1 : 0)
  return Math.max(0, Math.min(1, score))
}
