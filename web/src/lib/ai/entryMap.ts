import { isCognitiveMap, type Beat, type CognitiveMap, type Edge } from '@/lib/cognitive-map'
import { apiPost } from '@/lib/api/client'
import { updateCognitiveMap } from '@/lib/firestore/journals'
import { needsCognitiveMap } from '@/lib/firestore/codec'
import { COGNITIVE_MAP_VERSION, type JournalEntry } from '@/lib/firestore/models'

/** `POST /v1/ai/entry-map`. Mirrors the iOS `EntryMapResponse`. */
interface EntryMapResponse {
  v?: number
  beats: Beat[]
  edges: Edge[]
  model?: string
  generatedAt?: string
}

/**
 * In-flight entry ids, so the journal page opening the Map tab and any other caller
 * cannot fire two extractions for the same entry. Module scope is the right lifetime:
 * it matches how long the tab is open. Mirrors the iOS in-flight claim.
 */
const inFlight = new Set<string>()

/**
 * Ensure `entry` has a cognitive map, generating one if it is missing or stale.
 *
 * Zero-knowledge: the entry's PLAINTEXT content goes to the stateless endpoint, which
 * retains nothing, and the returned map is encrypted here before it is written. The
 * server never holds a readable copy.
 *
 * Best-effort by design. Returns true only when a map was generated AND persisted;
 * every failure path returns false and writes nothing, because a missing map is a far
 * better outcome than a wrong one.
 */
export async function ensureCognitiveMap(entry: JournalEntry): Promise<boolean> {
  if (!needsCognitiveMap(entry)) return false
  if (inFlight.has(entry.id)) return false
  inFlight.add(entry.id)

  try {
    const response = await apiPost<EntryMapResponse>('/v1/ai/entry-map', {
      content: entry.content,
      type: entry.type,
    })

    const map: CognitiveMap = { v: 1, beats: response.beats, edges: response.edges }
    // Validate before persisting: an invalid map stored is an invalid map every
    // client then has to defend against forever.
    if (!isCognitiveMap(map)) return false

    await updateCognitiveMap(entry.id, {
      map,
      generatedAt: response.generatedAt ? new Date(response.generatedAt) : new Date(),
      model: response.model ?? '',
      version: COGNITIVE_MAP_VERSION,
    })
    return true
  } catch (err) {
    console.warn('[cognitive-map] generation failed', err)
    return false
  } finally {
    inFlight.delete(entry.id)
  }
}
