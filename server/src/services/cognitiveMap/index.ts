import { chatCompletion, chatModelChain, embed } from '../aiClient'
import { PROMPTS } from '../prompts'
import { parseCandidates, verifyQuotes, targetCandidateCount, type RawCandidate } from './extract'
import { collapseDuplicates } from './dedupe'
import { formatBeatList, parseEdges } from './edges'
import { buildBeats } from './prune'
import type { CandidateBeat, CognitiveMap, Edge } from './types'

export type { CognitiveMap } from './types'

const JSON_MODE = { type: 'json_object' } as const

async function completionText(
  messages: Array<{ role: string; content: string }>,
  model: string,
): Promise<string> {
  const res = await chatCompletion(messages, { model, response_format: JSON_MODE })
  if (!res.ok) throw new Error(`AI error: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

/**
 * Pass A against ONE model, including the repair retry.
 *
 * The repair pass exists because models paraphrase quotes constantly, and a beat
 * whose quote is not verbatim in the entry is unusable: tap-to-source would show the
 * reader a sentence they never wrote. We name the offenders and ask once more, then
 * drop whatever still fails. Returns null when nothing survives, so the caller can
 * advance to the next model.
 */
async function extractWith(model: string, content: string): Promise<CandidateBeat[] | null> {
  const system = PROMPTS.cognitiveMapExtract(targetCandidateCount(content))

  const attempt = async (extraInstruction?: string): Promise<RawCandidate[] | null> => {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content },
    ]
    if (extraInstruction) messages.push({ role: 'user', content: extraInstruction })
    return parseCandidates(await completionText(messages, model))
  }

  const first = await attempt()
  if (!first) return null

  let { verified, failed } = verifyQuotes(first, content)
  if (failed.length > 0) {
    const names = failed.map(q => `- ${q}`).join('\n')
    const repair = await attempt(
      `These quotes were NOT found verbatim in the entry:\n${names}\n\n` +
      `Redo the extraction. Every "quote" must be copied character for character ` +
      `from the entry text above. Return the full beats array again.`,
    )
    if (repair) {
      const retried = verifyQuotes(repair, content)
      // Keep the repair only if it actually did better.
      if (retried.verified.length > verified.length) verified = retried.verified
    }
  }

  return verified.length > 0 ? verified : null
}

/** Embed the candidates for dedupe. Best-effort: failure degrades to no dedupe. */
async function embedCandidates(candidates: CandidateBeat[]): Promise<number[][]> {
  try {
    return await embed(candidates.map(c => c.text))
  } catch {
    return []
  }
}

/** Pass B. Best-effort: beats with no edges are still a map. */
async function extractEdges(model: string, candidates: CandidateBeat[]): Promise<Edge[]> {
  try {
    const raw = await completionText([
      { role: 'system', content: PROMPTS.cognitiveMapEdges() },
      { role: 'user', content: formatBeatList(candidates) },
    ], model)
    return parseEdges(raw, new Set(candidates.map(c => c.id)))
  } catch {
    return []
  }
}

/**
 * Build an entry's cognitive map from its plaintext.
 *
 * STATELESS. No DEK, no Firestore read, no Firestore write, no vector write. The
 * caller (the device) encrypts the result and persists it itself. This function is
 * the only place the server ever sees an entry's words, and it forgets them when it
 * returns.
 *
 * RESILIENCE: walks the provider's model chain exactly as `generateEntryAI` does,
 * because Morpheus priority-gates per model and the primary slug can 503 while a
 * sibling still serves. Pass B and the embedding call degrade independently: an entry
 * with beats and no edges is a worse map, not a failure.
 */
export async function generateEntryMap(params: {
  content: string
}): Promise<CognitiveMap & { model: string; generatedAt: string }> {
  let lastErr: unknown = new Error('Cognitive map: unparseable response')

  for (const model of chatModelChain()) {
    let candidates: CandidateBeat[] | null
    try {
      candidates = await extractWith(model, params.content)
    } catch (err) {
      lastErr = err
      continue
    }
    if (!candidates) continue

    const deduped = collapseDuplicates(candidates, await embedCandidates(candidates))
    const edges = await extractEdges(model, deduped)
    const beats = buildBeats(deduped, edges)
    // Defensive: dedupe renumbers before edges are extracted, so this should already
    // hold, but an edge pointing at a missing beat would crash layout on the client.
    const ids = new Set(beats.map(b => b.id))
    const safeEdges = edges.filter(e => ids.has(e.from) && ids.has(e.to))

    return {
      v: 1,
      beats,
      edges: safeEdges,
      model,
      generatedAt: new Date().toISOString(),
    }
  }

  throw lastErr
}
