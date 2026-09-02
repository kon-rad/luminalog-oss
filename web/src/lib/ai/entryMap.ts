import { isCognitiveMap, type Beat, type CognitiveMap, type Edge } from '@/lib/cognitive-map'
import { apiGet, apiPost } from '@/lib/api/client'
import { updateCognitiveMap } from '@/lib/firestore/journals'
import { needsCognitiveMap } from '@/lib/firestore/codec'
import { COGNITIVE_MAP_VERSION, type JournalEntry } from '@/lib/firestore/models'

/** `POST /v1/ai/entry-map` answers 202 with a ticket, not a map. */
interface EntryMapTicket {
  jobId: string
}

/** `GET /v1/ai/entry-map/{jobId}`. The map fields are set only when done. */
interface EntryMapJobResponse {
  status: 'pending' | 'done' | 'failed'
  error?: string
  v?: number
  beats?: Beat[]
  edges?: Edge[]
  model?: string
  generatedAt?: string
}

const POLL_INTERVAL_MS = 2_000
const POLL_CEILING_MS = 180_000

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Poll a map job to completion. Returns null when the job failed or the ceiling was
 * reached: the job keeps running server-side and jobs are deduped by content, so a
 * later call re-POSTs the same content and collects it on its first poll.
 */
async function pollMapJob(
  jobId: string, intervalMs: number, ceilingMs: number,
): Promise<EntryMapJobResponse | null> {
  const deadline = Date.now() + ceilingMs
  while (Date.now() < deadline) {
    const job = await apiGet<EntryMapJobResponse>(`/v1/ai/entry-map/${jobId}`)
    if (job.status === 'done') return job
    if (job.status === 'failed') return null
    await sleep(intervalMs)
  }
  return null
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
 *
 * `opts` is test-only: it exists so the poll loop can be walked without real waiting.
 */
export async function ensureCognitiveMap(
  entry: JournalEntry,
  opts: { pollIntervalMs?: number; pollCeilingMs?: number } = {},
): Promise<boolean> {
  if (!needsCognitiveMap(entry)) return false
  if (inFlight.has(entry.id)) return false
  inFlight.add(entry.id)

  try {
    // The server generates asynchronously: the POST starts a job and the map arrives on
    // a later poll. The pipeline takes 85 to 190 seconds, past any request timeout.
    const ticket = await apiPost<EntryMapTicket>('/v1/ai/entry-map', {
      content: entry.content,
      type: entry.type,
    })
    const response = await pollMapJob(
      ticket.jobId,
      opts.pollIntervalMs ?? POLL_INTERVAL_MS,
      opts.pollCeilingMs ?? POLL_CEILING_MS,
    )
    if (!response) return false

    const map: CognitiveMap = { v: 1, beats: response.beats ?? [], edges: response.edges ?? [] }
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
