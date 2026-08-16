import type { CandidateBeat, Mention } from './types'

/** Cosine similarity. Returns 0 rather than NaN for degenerate input. */
export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!
    dot += x * y
    normA += x * x
    normB += y * y
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function unionMentions(a: Mention[], b: Mention[]): Mention[] {
  const seen = new Map<string, Mention>()
  for (const m of [...a, ...b]) seen.set(`${m.type}:${m.surface}`, m)
  return [...seen.values()]
}

/**
 * Collapse near-duplicate candidates.
 *
 * One thought split across two beats is the most common visible artifact of
 * extraction, and it is the one a reader notices immediately: the map shows them
 * saying the same thing twice. Embedding the candidates and merging above a high
 * threshold removes it cheaply.
 *
 * The survivor is the member with the higher `generality`, because that is the one
 * more likely to become a keeper. Spine flags and mentions are unioned, so merging
 * never loses a signal a later step depends on.
 *
 * A mismatched or empty `embeddings` array makes this a no-op: the embedding call is
 * best-effort and its failure must not fail the whole extraction.
 */
export function collapseDuplicates(
  candidates: CandidateBeat[],
  embeddings: number[][],
  threshold = 0.94,
): CandidateBeat[] {
  if (embeddings.length !== candidates.length) return candidates

  const survivors: { beat: CandidateBeat; embedding: number[] }[] = []

  for (let i = 0; i < candidates.length; i++) {
    const beat = candidates[i]!
    const embedding = embeddings[i]!
    const twin = survivors.find(s => cosine(s.embedding, embedding) >= threshold)

    if (!twin) {
      survivors.push({ beat, embedding })
      continue
    }

    const keepIncoming = beat.generality > twin.beat.generality
    const winner = keepIncoming ? beat : twin.beat
    const loser = keepIncoming ? twin.beat : beat
    twin.beat = {
      ...winner,
      isSpine: winner.isSpine || loser.isSpine,
      mentions: unionMentions(winner.mentions, loser.mentions),
    }
    if (keepIncoming) twin.embedding = embedding
  }

  // Renumber so ids stay contiguous. Edges are extracted AFTER this step, so no
  // existing reference can be invalidated by the renumber.
  return survivors.map((s, index) => ({ ...s.beat, id: `b${index}` }))
}
